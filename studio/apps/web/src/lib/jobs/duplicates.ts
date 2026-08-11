import { electCanonical, roleClusters } from "@jobsearch/jobs-data";
import type { Job } from "./types";

/**
 * `1 -> B`, `25 -> Z`, `26 -> AA`. The canonical is index 0 and takes no suffix, so
 * copies read `#153B`, `#153C`. Must run past Z - one group has sixteen copies.
 */
function dupSuffix(index: number): string {
	if (index <= 0) return "";
	let out = "";
	// Bijective base 26 over the position after the canonical.
	for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
		out = String.fromCharCode(65 + ((n - 1) % 26)) + out;
	}
	return out;
}

/** How a duplicate reads on a card: the canonical's id plus a letter. */
export type DupCopy = {
	job: Job;
	canonical: Job;
	/** `#153B`, or `#B` if the canonical has no id yet. */
	label: string;
};

export type DupIndex = {
	/** Canonical key → copies, in id order. Canonicals with none are absent. */
	copies: Map<string, DupCopy[]>;
	of: Map<string, DupCopy>;
};

/** Lowest id first, then by key, so a group's letters never reshuffle. */
const byId = (a: Job, b: Job) =>
	(a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER) ||
	a.key.localeCompare(b.key);

/**
 * Groups read off the stored `duplicate_of` pointers, not re-derived, so what the
 * board hides is what the file says. A pointer at a missing key is ignored and the
 * entry stays visible - better a duplicate on screen than a vanished card.
 */
export function buildDupIndex(jobs: Job[]): DupIndex {
	const byKey = new Map(jobs.map((job) => [job.key, job]));
	const grouped = new Map<string, Job[]>();

	for (const job of jobs) {
		if (typeof job.duplicate_of !== "string") continue;
		const canonical = byKey.get(job.duplicate_of);
		if (!canonical || canonical.key === job.key) continue;
		const list = grouped.get(canonical.key);
		if (list) list.push(job);
		else grouped.set(canonical.key, [job]);
	}

	const copies = new Map<string, DupCopy[]>();
	const of = new Map<string, DupCopy>();
	for (const [canonicalKey, members] of grouped) {
		const canonical = byKey.get(canonicalKey) as Job;
		members.sort(byId);
		const list = members.map((job, i) => ({
			job,
			canonical,
			label: `#${canonical.id ?? ""}${dupSuffix(i + 1)}`,
		}));
		copies.set(canonicalKey, list);
		for (const copy of list) of.set(copy.job.key, copy);
	}
	return { copies, of };
}

/**
 * Which member the review dialog pre-selects. Same election the server runs on
 * URL-identical groups, so both agree.
 */
export function electDupCanonical(group: Job[]): Job {
	return electCanonical(group);
}

/**
 * Company+title matches among unjudged entries. Anything already linked or ruled
 * standalone is left out, so a rejected suggestion never comes back.
 */
export function suggestDupGroups(jobs: Job[]): Job[][] {
	const open = jobs.filter((job) => job.duplicate_of === undefined);
	const byKey = new Map(open.map((job) => [job.key, job]));
	return roleClusters(open).map((group) =>
		group.map((key) => byKey.get(key) as Job).sort(byId),
	);
}
