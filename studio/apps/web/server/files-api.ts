import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import { json, readBody } from "./http.ts";

/** The repo root, same reckoning as the chat API: the app lives four levels down. */
const ROOT = path.resolve(import.meta.dirname, "../../../..");

/**
 * What the reader may open, repo-relative. Everything personal is under `documents/`;
 * the skill folder holds the profile and template notes the CVs are written from, and
 * reading those next to the output is the point of the page.
 */
const ROOTS = ["documents", ".claude/skills/job-application-assistant"];

/**
 * The three documents the setup wizard writes, named in full rather than derived from a
 * folder rule. Everything else the reader lists is written by Claude or by a skill, and
 * a writable path built out of user input is how a reader becomes an editor for the
 * whole repo.
 */
const WRITABLE = new Set([
	"documents/cv/master_cv.md",
	"documents/linkedin/Profile.md",
	"documents/references/professional-record.md",
]);

/** Repo-relative .md paths under `dir`, or nothing if the folder is absent. */
async function walk(dir: string): Promise<string[]> {
	let entries: string[];
	try {
		entries = await readdir(path.join(ROOT, dir), { recursive: true });
	} catch {
		return [];
	}
	return entries
		.filter((entry) => entry.endsWith(".md"))
		.map((entry) => path.posix.join(dir, entry.split(path.sep).join("/")));
}

/**
 * A repo-relative path the caller asked for, resolved to an absolute one, or null if
 * it escapes the allowed roots. Symlinks are not chased: what `readdir` listed is what
 * can be read back.
 */
function resolveSafe(rel: string): string | null {
	if (!rel.endsWith(".md")) return null;
	const abs = path.resolve(ROOT, rel);
	const inside = ROOTS.some((root) => {
		const base = path.resolve(ROOT, root);
		return abs === base || abs.startsWith(`${base}${path.sep}`);
	});
	return inside ? abs : null;
}

/**
 * A document's own title: its first `# ` heading, or nothing if it opens without one.
 * Only the head of the file is scanned - a heading that first appears 200 lines in is
 * a section, not the document's name.
 */
function titleOf(text: string): string | undefined {
	for (const line of text.slice(0, 4000).split("\n")) {
		const heading = /^#\s+(.+?)\s*$/.exec(line);
		if (heading) return heading[1];
	}
	return undefined;
}

/**
 * The document reader's API, a dev-server plugin like the other two.
 *
 * GET  /api/files            every .md under the allowed roots, titled and dated
 * GET  /api/files?path=<rel> that one file's text
 * POST /api/files            `{ path, text }`, for the three documents in WRITABLE
 *
 * Read-only but for those three: the page is for reading what the skills wrote, and
 * Claude already writes these files from chat. The wizard needs somewhere to put a CV on
 * a first run, when there is no profile for Claude to write one from yet.
 */
export function filesApi(): Plugin {
	return {
		name: "files-api",
		configureServer(server: ViteDevServer) {
			const logger = server.config.logger;

			server.middlewares.use("/api/files", async (req, res, next) => {
				if (req.method !== "GET" && req.method !== "POST") {
					next();
					return;
				}

				try {
					if (req.method === "POST") {
						const body = (await readBody(req)) as Record<string, unknown>;
						const rel = typeof body?.path === "string" ? body.path : "";
						if (!WRITABLE.has(rel)) {
							json(res, 400, { error: "that document is not writable" });
							return;
						}
						if (typeof body.text !== "string") {
							json(res, 400, { error: "`text` must be a string" });
							return;
						}
						const abs = path.resolve(ROOT, rel);
						// The folders ship empty, so a first run creates the one it needs.
						await mkdir(path.dirname(abs), { recursive: true });
						const text = body.text.endsWith("\n")
							? body.text
							: `${body.text}\n`;
						await writeFile(abs, text, "utf8");
						logger.info(`[files-api] wrote ${rel}`);
						json(res, 200, { path: rel });
						return;
					}

					const url = new URL(req.url ?? "/", "http://localhost");
					const rel = url.searchParams.get("path");

					if (rel) {
						const abs = resolveSafe(rel);
						if (!abs) {
							json(res, 400, { error: "path outside the allowed roots" });
							return;
						}
						json(res, 200, { path: rel, text: await readFile(abs, "utf8") });
						return;
					}

					const paths = (await Promise.all(ROOTS.map(walk))).flat();
					// Every file is opened for its title. They are notes and CVs, tens of
					// kilobytes at the largest, and a listing that says "job_posting.md"
					// four times over is not a listing.
					const files = await Promise.all(
						paths.map(async (file) => {
							const abs = path.resolve(ROOT, file);
							const [info, text] = await Promise.all([
								stat(abs),
								readFile(abs, "utf8"),
							]);
							return {
								path: file,
								title: titleOf(text),
								size: info.size,
								mtime: info.mtimeMs,
							};
						}),
					);
					json(res, 200, { files });
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					logger.error(`[files-api] ${message}`);
					json(res, 500, { error: message });
				}
			});
		},
	};
}
