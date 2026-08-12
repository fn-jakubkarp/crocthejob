import type { Plugin, ViteDevServer } from "vite";
import { json } from "./http.ts";
import { createJob } from "./routes/create.ts";
import { importJobs } from "./routes/import.ts";
import { listJobs } from "./routes/list.ts";
import { patchJobs } from "./routes/patch.ts";
import { savePostingRoute } from "./routes/posting.ts";
import { removeJob } from "./routes/remove.ts";

/**
 * The board's API, mounted on the dev server, not its own process — `bun run dev` is
 * the only thing to start. One endpoint, /api/jobs: GET reads the file, PATCH edits
 * one entry or a batch, POST adds one by hand, DELETE drops one that was added by hand.
 * POST /api/jobs/posting saves a JD typed in by hand, for an entry /scrape never kept one for.
 * POST /api/jobs/import folds in a jobs file exported somewhere else.
 *
 * Only the HTTP shape lives here. What an entry is, what a request may say and what a
 * change does to the file all belong to `@jobsearch/jobs-data`, which the PDF app will
 * read the same records through.
 */
export function jobsApi(): Plugin {
	return {
		name: "jobs-api",
		configureServer(server: ViteDevServer) {
			const logger = server.config.logger;

			server.middlewares.use("/api/jobs", async (req, res, next) => {
				// req.url is relative to the mount point: "/" for the collection.
				const url = req.url ?? "/";
				const collection = url === "/" || url === "";

				try {
					if (collection && req.method === "GET") {
						await listJobs(res, logger);
						return;
					}
					if (collection && req.method === "PATCH") {
						await patchJobs(req, res, logger);
						return;
					}
					if (collection && req.method === "POST") {
						await createJob(req, res, logger);
						return;
					}
					if (collection && req.method === "DELETE") {
						await removeJob(req, res, logger);
						return;
					}
					if (url === "/posting" && req.method === "POST") {
						await savePostingRoute(req, res, logger);
						return;
					}
					if (url === "/import" && req.method === "POST") {
						await importJobs(req, res, logger);
						return;
					}
					next();
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					logger.error(`[jobs-api] ${message}`);
					json(res, 500, { error: message });
				}
			});
		},
	};
}
