import type { JobEntry, JobsFile } from "./schema.ts";

const isId = (value: unknown): value is number =>
	typeof value === "number" && Number.isInteger(value) && value > 0;

/**
 * An `id` for every entry, in first-seen order. Never reused: `next_id` survives a
 * deletion, recomputed from the highest id present if /scrape rewrites without it.
 */
export function assignIds(data: JobsFile): number {
	let highest = 0;
	const missing: [string, JobEntry][] = [];
	for (const [key, entry] of Object.entries(data.seen)) {
		if (isId(entry.id)) highest = Math.max(highest, entry.id);
		else missing.push([key, entry]);
	}

	const stored = isId(data.next_id) ? data.next_id : 0;
	let next = Math.max(stored, highest + 1, 1);

	missing.sort(
		([keyA, a], [keyB, b]) =>
			(a.first_seen ?? "9999-99-99").localeCompare(
				b.first_seen ?? "9999-99-99",
			) || keyA.localeCompare(keyB),
	);
	// Rebuilt with the id first, not appended: appending adds a comma to the entry's
	// old last line, doubling the backfill diff. Ahead of `title` is one line per entry.
	for (const [key, entry] of missing) {
		data.seen[key] = { id: next++, ...entry };
	}

	if (data.next_id !== next) data.next_id = next;
	return missing.length;
}
