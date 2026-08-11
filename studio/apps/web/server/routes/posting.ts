import { access, mkdir, writeFile } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import path from "node:path";
import { NOTES_LIMIT, slug, text, today } from "@jobsearch/jobs-data";
import {
	JOBS_FILE,
	readJobs,
	savePosting,
	serialise,
	writeJobs,
} from "@jobsearch/jobs-data/server";
import type { Connect, Logger } from "vite";
import { json, readBody } from "../http.ts";

/**
 * `documents/`, next to wherever `data/jobs.json` turned out to live - the same
 * reckoning `JOBS_FILE` already made, so this never bakes in a repo-specific path of
 * its own. See `store.ts`.
 */
const POSTINGS_DIR = path.resolve(
	path.dirname(JOBS_FILE),
	"../documents/postings",
);

/** The first name on disk nobody holds yet, so two postings slugging the same never collide. */
async function freeName(base: string): Promise<string> {
	for (let n = 1; ; n++) {
		const name = n === 1 ? `${base}.md` : `${base}-${n}.md`;
		try {
			await access(path.join(POSTINGS_DIR, name));
		} catch {
			return name;
		}
	}
}

/**
 * Saves a JD by hand when /scrape never had one to keep - a posting typed or pasted
 * in, filed exactly where /scrape would have left it, so the reader and the rest of
 * the board cannot tell the two apart.
 *
 * POST /api/jobs/posting { key, text } -> { path }
 *
 * The one write files-api.ts deliberately does not offer: that one only ever reads
 * back what a skill wrote. This is the board's own file, hand to hand.
 */
export async function savePostingRoute(
	req: Connect.IncomingMessage,
	res: ServerResponse,
	logger: Logger,
): Promise<void> {
	const payload = (await readBody(req)) as Record<string, unknown>;
	const key = typeof payload?.key === "string" ? payload.key : null;
	if (!key) {
		json(res, 400, { error: "expected a string `key`" });
		return;
	}

	let body: string | null;
	try {
		body = text(payload?.text, NOTES_LIMIT);
	} catch (e) {
		json(res, 400, { error: e instanceof Error ? e.message : String(e) });
		return;
	}
	if (!body) {
		json(res, 400, { error: "expected non-empty `text`" });
		return;
	}

	const result = await serialise(async () => {
		const data = await readJobs();
		const entry = data.seen[key];
		if (!entry) {
			return {
				ok: false as const,
				code: 404,
				error: `no entry for key "${key}"`,
			};
		}
		if (entry.posting_file) {
			return {
				ok: false as const,
				code: 409,
				error: "a copy is already saved for this posting",
			};
		}

		const base =
			slug(`${entry.company ?? ""}-${entry.title ?? ""}`) || "posting";
		await mkdir(POSTINGS_DIR, { recursive: true });
		const name = await freeName(base);
		const relPath = `documents/postings/${name}`;

		const doc = [
			`# ${entry.title ?? "Untitled"} - ${entry.company ?? "?"}`,
			"",
			`Saved: ${today()} (added by hand)`,
			"",
			"---",
			"",
			body,
			"",
		].join("\n");
		await writeFile(path.join(POSTINGS_DIR, name), doc, "utf8");

		savePosting(data.seen, key, relPath);
		await writeJobs(data);
		return { ok: true as const, path: relPath };
	});

	if (!result.ok) {
		json(res, result.code, { error: result.error });
		return;
	}
	logger.info(`[jobs-api] saved posting copy for ${key} -> ${result.path}`);
	json(res, 200, { path: result.path });
}
