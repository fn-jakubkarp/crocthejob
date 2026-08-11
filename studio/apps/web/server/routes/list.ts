import type { ServerResponse } from "node:http";
import { STATUSES } from "@jobsearch/jobs-data";
import {
	assignIds,
	linkCertainDuplicates,
	readJobs,
	serialise,
	writeJobs,
} from "@jobsearch/jobs-data/server";
import type { Logger } from "vite";
import { json } from "../http.ts";

/**
 * The whole file as a list. The read also runs the two repair passes — id backfill and
 * URL-identical duplicate linking — inside the queue, so neither races a PATCH.
 */
export async function listJobs(
	res: ServerResponse,
	logger: Logger,
): Promise<void> {
	const data = await serialise(async () => {
		const data = await readJobs();
		const assigned = assignIds(data);
		const linked = linkCertainDuplicates(data);
		if (assigned > 0 || linked.length > 0) {
			await writeJobs(data);
			if (assigned > 0) {
				logger.info(
					`[jobs-api] assigned ${assigned} id${assigned === 1 ? "" : "s"}`,
				);
			}
			if (linked.length > 0) {
				logger.info(
					`[jobs-api] linked ${linked.length} URL-identical duplicate${
						linked.length === 1 ? "" : "s"
					}`,
				);
			}
		}
		return data;
	});

	const jobs = Object.entries(data.seen).map(([key, entry]) => ({
		key,
		...entry,
	}));
	json(res, 200, { jobs, statuses: STATUSES });
}
