import type { ServerResponse } from "node:http";
import { isManual } from "@jobsearch/jobs-data";
import {
	readJobs,
	remove,
	serialise,
	writeJobs,
} from "@jobsearch/jobs-data/server";
import type { Connect, Logger } from "vite";
import { json, readBody } from "../http.ts";

/**
 * Drops one hand-added entry from the file. Hand-added only, and checked here rather
 * than trusted from the board: a scraped posting deleted here returns on the next
 * /scrape, so the button that offers it would be lying.
 *
 * No soft delete. Skipped is where a posting goes when it is ruled out and the reason
 * is worth keeping; this is for the entry that should never have been typed in.
 */
export async function removeJob(
	req: Connect.IncomingMessage,
	res: ServerResponse,
	logger: Logger,
): Promise<void> {
	const payload = (await readBody(req)) as { key?: unknown };
	const key = payload?.key;
	if (typeof key !== "string" || key === "") {
		json(res, 400, { error: "expected { key: string }" });
		return;
	}

	const result = await serialise(async () => {
		const data = await readJobs();
		const entry = data.seen[key];
		if (!entry) return { ok: false as const, code: 404, error: "no entry" };
		if (!isManual(entry)) {
			return {
				ok: false as const,
				code: 403,
				error: "only a hand-added posting can be deleted",
			};
		}
		const freed = remove(data.seen, key);
		await writeJobs(data);
		return { ok: true as const, entry, freed };
	});

	if (!result.ok) {
		json(res, result.code, { error: result.error, key });
		return;
	}

	logger.info(
		`[jobs-api] deleted: ${result.entry.company ?? "?"} — ${result.entry.title ?? "?"} (#${result.entry.id ?? "?"})`,
	);
	json(res, 200, { key, freed: result.freed });
}
