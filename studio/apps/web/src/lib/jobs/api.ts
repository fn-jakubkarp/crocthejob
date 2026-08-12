import type { Job, JobChanges, NewJob } from "./types";

const ENDPOINT = "/api/jobs";

async function failure(res: Response, what: string): Promise<Error> {
	const detail = (await res.json().catch(() => null)) as {
		error?: string;
	} | null;
	return new Error(detail?.error ?? `${what} failed: ${res.status}`);
}

/** Every write is the same request with a different body shape. */
async function patch(body: unknown): Promise<Response> {
	const res = await fetch(ENDPOINT, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!res.ok) throw await failure(res, `PATCH ${ENDPOINT}`);
	return res;
}

export async function fetchJobs(): Promise<Job[]> {
	const res = await fetch(ENDPOINT);
	if (!res.ok) throw new Error(`GET ${ENDPOINT} failed: ${res.status}`);
	const data = (await res.json()) as { jobs: Job[] };
	return data.jobs;
}

/**
 * Returns the key the entry now has. Correcting the URL of a URL-keyed entry moves it,
 * since the key is what /scrape dedupes on - the caller must follow it or the next
 * write addresses an entry that has gone.
 */
export async function patchJob(
	key: string,
	changes: JobChanges,
): Promise<string> {
	const res = await patch({ key, ...changes });
	const result = (await res.json()) as { rekeyed?: Record<string, string> };
	return result.rekeyed?.[key] ?? key;
}

/**
 * One request for the whole selection. The server resolves every key before assigning
 * anything and writes once, so a batch is all-or-nothing.
 */
export async function patchJobs(
	keys: string[],
	changes: JobChanges,
): Promise<void> {
	await patch({ keys, ...changes });
}

/**
 * Per-entry changes in one all-or-nothing write. A duplicate group needs this over
 * `patchJobs`: copies take a canonical key and separates take null, same request.
 */
export async function patchEdits(
	edits: ({ key: string } & JobChanges)[],
): Promise<void> {
	if (edits.length === 0) return;
	await patch({ edits });
}

/**
 * Drops a hand-added entry. The server refuses anything /scrape found, so a scraped
 * posting cannot be removed by hand-rolling this request.
 */
export async function deleteJob(key: string): Promise<void> {
	const res = await fetch(ENDPOINT, {
		method: "DELETE",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ key }),
	});
	if (!res.ok) throw await failure(res, `DELETE ${ENDPOINT}`);
}

export async function createJob(draft: NewJob): Promise<Job> {
	const res = await fetch(ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(draft),
	});
	if (!res.ok) throw await failure(res, `POST ${ENDPOINT}`);
	return (await res.json()) as Job;
}

/**
 * Folds a jobs file exported somewhere else into this one. Additive: the server leaves
 * every entry the board already holds exactly as it is.
 */
export async function importJobs(
	payload: unknown,
): Promise<{ added: number; skipped: number; dropped: number }> {
	const res = await fetch(`${ENDPOINT}/import`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	if (!res.ok) throw await failure(res, `POST ${ENDPOINT}/import`);
	return (await res.json()) as {
		added: number;
		skipped: number;
		dropped: number;
	};
}

/** Saves a hand-typed JD for an entry /scrape never kept one for. Returns its path. */
export async function saveJobPosting(
	key: string,
	text: string,
): Promise<string> {
	const res = await fetch(`${ENDPOINT}/posting`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ key, text }),
	});
	if (!res.ok) throw await failure(res, `POST ${ENDPOINT}/posting`);
	const result = (await res.json()) as { path: string };
	return result.path;
}
