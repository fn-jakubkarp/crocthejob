import { electCanonical, urlClusters } from "./dupes.ts";
import type { JobEntry, JobsFile } from "./schema.ts";

/** The fields the canonical election reads, for one key. */
const elective = (seen: Record<string, JobEntry>, key: string) => ({
	key,
	id: seen[key].id,
	status: seen[key].status,
	rank_score: seen[key].rank_score,
	first_seen: seen[key].first_seen,
});

/**
 * Files postings sharing a canonical URL under one of them. URL signal only: a
 * company+title match can be two separate postings, so the board asks first.
 *
 * Touches only entries with no `duplicate_of` at all, which makes this idempotent and
 * leaves every hand-made decision standing.
 */
export function linkCertainDuplicates(data: JobsFile): string[] {
	const seen = data.seen;
	const candidates = Object.entries(seen).map(([key, entry]) => ({
		key,
		url: typeof entry.url === "string" ? entry.url : undefined,
	}));

	const linked: string[] = [];
	for (const group of urlClusters(candidates)) {
		// An entry ruled standalone leaves the group, never gets re-linked.
		const live = group.filter((key) => seen[key].duplicate_of !== null);
		if (live.length < 2) continue;

		const canonical = electCanonical(live.map((key) => elective(seen, key)));
		// The elected canonical filed under something else means the group was already
		// decided by hand; leave all of it alone.
		if (typeof seen[canonical.key].duplicate_of === "string") continue;

		for (const key of live) {
			if (key === canonical.key) continue;
			if (seen[key].duplicate_of !== undefined) continue;
			seen[key].duplicate_of = canonical.key;
			linked.push(key);
		}
	}
	return linked;
}

/** Follows a duplicate chain to the entry that is nobody's copy. */
export function canonicalOf(
	seen: Record<string, JobEntry>,
	key: string,
): string {
	let current = key;
	for (let hop = 0; hop < 8; hop++) {
		const next = seen[current]?.duplicate_of;
		if (typeof next !== "string" || next === current || !seen[next]) break;
		current = next;
	}
	return current;
}
