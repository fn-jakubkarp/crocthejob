import type { ServerResponse } from "node:http";
import { mergeImport, readImport } from "@jobsearch/jobs-data";
import {
	assignIds,
	readJobs,
	serialise,
	writeJobs,
} from "@jobsearch/jobs-data/server";
import type { Connect, Logger } from "vite";
import { json, readBody } from "../http.ts";

/** A jobs file, not one posting: a few thousand entries is a legitimate body here. */
const IMPORT_LIMIT = 16_000_000;

/**
 * A jobs file somebody exported, folded into this one. Additive: what the board already
 * holds is never overwritten, since that copy is the one with the stages typed into it.
 */
export async function importJobs(
	req: Connect.IncomingMessage,
	res: ServerResponse,
	logger: Logger,
): Promise<void> {
	const incoming = readImport(await readBody(req, IMPORT_LIMIT));
	if (typeof incoming === "string") {
		json(res, 400, { error: incoming });
		return;
	}

	const counts = await serialise(async () => {
		const data = await readJobs();
		const result = mergeImport(data, incoming);
		// Nothing new is nothing to write: an import run twice must not rewrite the file.
		if (result.added > 0) {
			assignIds(data);
			await writeJobs(data);
		}
		return result;
	});

	logger.info(
		`[jobs-api] imported ${counts.added} entries (${counts.skipped} already on the board, ${counts.dropped} unreadable)`,
	);
	json(res, 200, counts);
}
