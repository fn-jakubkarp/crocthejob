import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { JobsFile } from "./schema.ts";

/** `studio/`, the root of the workspace this package lives in. */
const STUDIO = path.resolve(import.meta.dirname, "../..");

/**
 * Where the data lives, in the order the answers are trusted:
 *
 * 1. `JOBS_FILE` in the environment. The only one that always wins, so a checkout
 *    can point at a file anywhere without editing code.
 * 2. `../data/jobs.json` alongside `studio/`, when that file already exists. This is
 *    the private repo `studio/` was extracted from, where the board is one consumer
 *    of a file that `/scrape` and `/rank` also write.
 * 3. `studio/data/jobs.json`. The standalone default, created on first write.
 *
 * Resolved once at import so every route agrees, and deliberately without personal
 * data or a repo-specific path baked in: `studio/` has to be publishable on its own.
 */
function locate(): string {
	const configured = process.env.JOBS_FILE;
	if (configured) return path.resolve(configured);
	const alongside = path.resolve(STUDIO, "../data/jobs.json");
	if (fsSync.existsSync(alongside)) return alongside;
	return path.resolve(STUDIO, "data/jobs.json");
}

export const JOBS_FILE = locate();

/**
 * Serialises read-modify-write cycles, so a debounced notes save cannot interleave
 * with a drag's status write.
 */
let queue: Promise<unknown> = Promise.resolve();
export function serialise<T>(work: () => Promise<T>): Promise<T> {
	const run = queue.then(work, work);
	queue = run.catch(() => {});
	return run;
}

export async function readJobs(): Promise<JobsFile> {
	let raw: string;
	try {
		raw = await fs.readFile(JOBS_FILE, "utf8");
	} catch (error) {
		// A fresh checkout has no file yet, and "ENOENT" alone does not say which
		// path was tried or how to change it.
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return { seen: {} };
		}
		throw error;
	}
	const parsed = JSON.parse(raw) as JobsFile;
	if (!parsed || typeof parsed.seen !== "object" || parsed.seen === null) {
		throw new Error(`${JOBS_FILE} has no \`seen\` object`);
	}
	return parsed;
}

/** Temp file then rename, so a crash cannot truncate the real one. */
export async function writeJobs(data: JobsFile): Promise<void> {
	const { next_id, ...rest } = data;
	const out = next_id === undefined ? rest : { next_id, ...rest };
	await fs.mkdir(path.dirname(JOBS_FILE), { recursive: true });
	const tmp = `${JOBS_FILE}.tmp-${process.pid}`;
	await fs.writeFile(tmp, `${JSON.stringify(out, null, 2)}\n`, "utf8");
	await fs.rename(tmp, JOBS_FILE);
}
