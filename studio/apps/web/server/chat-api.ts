import { spawn } from "node:child_process";
import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import { json, readBody } from "./http.ts";

/**
 * The repo root, not the app: `claude` has to run where `.claude/skills/`, `CLAUDE.md`
 * and `documents/` are, or the skills never load.
 */
const ROOT = path.resolve(import.meta.dirname, "../../../..");

/**
 * A chat endpoint that shells out to the local `claude` CLI, so the browser talks to
 * the same Claude Code install the terminal does - same subscription, same skills, same
 * working directory. No API key, no SDK.
 *
 * POST /api/chat {prompt, sessionId?} streams the CLI's stream-json output straight
 * back as NDJSON. `sessionId` comes from the init line of the previous turn and is what
 * makes it a conversation rather than a series of one-shots.
 */
export function chatApi(): Plugin {
	return {
		name: "chat-api",
		configureServer(server: ViteDevServer) {
			const logger = server.config.logger;

			server.middlewares.use("/api/chat", async (req, res, next) => {
				if (req.method !== "POST") {
					next();
					return;
				}

				let prompt: string;
				let sessionId: string | undefined;
				try {
					const body = (await readBody(req)) as {
						prompt?: unknown;
						sessionId?: unknown;
					};
					prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
					sessionId =
						typeof body?.sessionId === "string" ? body.sessionId : undefined;
				} catch (err) {
					json(res, 400, { error: String(err) });
					return;
				}
				if (!prompt) {
					json(res, 400, { error: "prompt required" });
					return;
				}

				const args = [
					"-p",
					prompt,
					"--output-format",
					"stream-json",
					"--verbose",
					// Reads are free; this also lets it write the tailored CV it was asked
					// for. Bash and the rest still need an explicit grant.
					// ponytail: acceptEdits, widen to --dangerously-skip-permissions only
					// if a skill turns out to need the shell.
					"--permission-mode",
					"acceptEdits",
				];
				if (sessionId) args.push("--resume", sessionId);

				const child = spawn("claude", args, {
					cwd: ROOT,
					stdio: ["ignore", "pipe", "pipe"],
				});

				res.statusCode = 200;
				res.setHeader("Content-Type", "application/x-ndjson");
				res.setHeader("Cache-Control", "no-store");

				child.stdout.pipe(res);
				child.stderr.on("data", (chunk) => {
					logger.error(`[chat] ${String(chunk).trimEnd()}`);
				});
				child.on("error", (err) => {
					logger.error(`[chat] spawn failed: ${err.message}`);
					res.end(`${JSON.stringify({ type: "error", error: err.message })}\n`);
				});
				// A closed tab should not leave a Claude session running.
				req.on("close", () => child.kill());
			});
		},
	};
}
