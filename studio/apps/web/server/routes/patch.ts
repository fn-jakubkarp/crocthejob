import type { ServerResponse } from "node:http";
import type { Changes, JobEntry, JobsFile } from "@jobsearch/jobs-data";
import {
	apply,
	canonicalOf,
	readChanges,
	readJobs,
	rekeyTarget,
	serialise,
	writeJobs,
} from "@jobsearch/jobs-data/server";
import type { Connect, Logger } from "vite";
import { json, readBody } from "../http.ts";

const BATCH_LIMIT = 500;

/** One entry and the changes it takes. */
type Work = { key: string; changes: Changes };

/** A response to send instead of writing anything. */
type Refusal = { code: number; body: Record<string, unknown> };

type Result =
	| { ok: false; refusal: Refusal }
	| {
			ok: true;
			touched: string[];
			log: string[];
			/** Old key -> new key, for entries a URL edit moved. */
			rekeyed: Record<string, string>;
	  };

const bad = (error: string, rest: Record<string, unknown> = {}): Refusal => ({
	code: 400,
	body: { error, ...rest },
});

/**
 * Three shapes normalised to one list: one key, a batch sharing changes, or an
 * `edits` array carrying its own. The duplicate review needs the third - confirming
 * a group writes a different value per member.
 */
function readWork(payload: {
	key?: unknown;
	keys?: unknown;
	edits?: unknown;
}): Work[] | Refusal {
	const work: Work[] = [];

	if (Array.isArray(payload?.edits)) {
		for (const item of payload.edits) {
			if (!item || typeof item !== "object") {
				return bad("each edit must be an object");
			}
			const record = item as Record<string, unknown>;
			if (typeof record.key !== "string") {
				return bad("each edit needs a string `key`");
			}
			const changes = readChanges(record);
			if (typeof changes === "string") {
				return bad(`${record.key}: ${changes}`);
			}
			work.push({ key: record.key, changes });
		}
	} else {
		const keys: string[] | null = Array.isArray(payload?.keys)
			? payload.keys.every((k) => typeof k === "string")
				? (payload.keys as string[])
				: null
			: typeof payload?.key === "string"
				? [payload.key]
				: null;
		if (!keys || keys.length === 0) {
			return bad(
				"expected { key: string | keys: string[] | edits: [{ key, … }] } with status, notes or duplicate_of",
			);
		}
		const changes = readChanges(payload as Record<string, unknown>);
		if (typeof changes === "string") return bad(changes);
		for (const key of keys) work.push({ key, changes });
	}

	if (work.length === 0) return bad("nothing to change");
	if (work.length > BATCH_LIMIT) {
		return bad(
			`batch of ${work.length} exceeds the ${BATCH_LIMIT}-entry limit`,
		);
	}
	return work;
}

/**
 * Everything that makes a batch impossible, checked before anything is assigned — so
 * a batch naming a missing key changes nothing at all.
 */
function refuse(seen: Record<string, JobEntry>, work: Work[]): Refusal | null {
	// Every key, and every duplicate target, has to exist.
	const missing = [
		...new Set(
			work.flatMap(({ key, changes }) => {
				const wanted = [key];
				if (typeof changes.duplicate_of === "string") {
					wanted.push(changes.duplicate_of);
				}
				return wanted.filter((k) => !seen[k]);
			}),
		),
	];
	if (missing.length > 0) {
		return {
			code: 404,
			body: {
				error:
					missing.length === 1
						? `no entry for key "${missing[0]}"`
						: `${missing.length} keys are not in the file; nothing was changed`,
				missing,
			},
		};
	}

	const cycles: string[] = [];
	for (const { key, changes } of work)
		if (
			typeof changes.duplicate_of === "string" &&
			canonicalOf(seen, changes.duplicate_of) === key
		)
			cycles.push(key);
	if (cycles.length > 0) {
		return bad(
			`an entry cannot be a duplicate of itself (${cycles.length} of ${work.length}); nothing was changed`,
			{ cycles },
		);
	}

	// Re-keying onto a key another entry holds would overwrite it, so refuse the batch.
	const clashes: string[] = [];
	for (const { key, changes } of work) {
		if (typeof changes.url !== "string") continue;
		const target = rekeyTarget(seen[key], key, changes.url);
		if (target !== null && seen[target] !== undefined) clashes.push(key);
	}
	if (clashes.length > 0) {
		return {
			code: 409,
			body: {
				error:
					"another entry is already keyed by that URL; nothing was changed",
				clashes,
			},
		};
	}

	return null;
}

/** Applies the whole list to the loaded file, writing once if anything moved. */
async function commit(data: JobsFile, work: Work[]): Promise<Result> {
	const seen = data.seen;
	const refusal = refuse(seen, work);
	if (refusal) return { ok: false, refusal };

	const touched: string[] = [];
	const log: string[] = [];
	const rekeyed: Record<string, string> = {};
	for (const { key, changes } of work) {
		// Held across `apply`: the reference survives a re-key, `seen[key]` does not.
		const entry = seen[key];
		const moved = apply(seen, key, changes);
		if (moved.length === 0) continue;
		touched.push(key);
		if (!seen[key] && typeof entry.url === "string") {
			rekeyed[key] = entry.url;
		}
		log.push(
			`${entry.company ?? "?"} — ${entry.title ?? "?"}: ${moved.join(", ")}`,
		);
	}

	if (touched.length > 0) await writeJobs(data);
	return { ok: true, touched, log, rekeyed };
}

export async function patchJobs(
	req: Connect.IncomingMessage,
	res: ServerResponse,
	logger: Logger,
): Promise<void> {
	const payload = (await readBody(req)) as {
		key?: unknown;
		keys?: unknown;
		edits?: unknown;
	};

	const work = readWork(payload ?? {});
	if (!Array.isArray(work)) {
		json(res, work.code, work.body);
		return;
	}

	const result = await serialise(async () => commit(await readJobs(), work));
	if (!result.ok) {
		json(res, result.refusal.code, result.refusal.body);
		return;
	}

	if (result.touched.length > 0) {
		logger.info(
			result.touched.length === 1
				? `[jobs-api] ${result.log[0]}`
				: `[jobs-api] batch of ${result.touched.length}: ${result.log.join("; ")}`,
		);
	}
	json(res, 200, {
		keys: work.map((item) => item.key),
		changed: result.touched.length,
		// Only when a URL edit moved an entry, so the board can follow the new key.
		...(Object.keys(result.rekeyed).length > 0
			? { rekeyed: result.rekeyed }
			: {}),
	});
}
