/**
 * The fetched list into what each column shows. Pure - no React, no fetching - so the
 * filter and grouping rules read in one place.
 */

import {
	COLUMNS,
	columnOf,
	type Job,
	outcomeTags,
	type SortId,
	type Status,
	sorter,
} from "@/lib/jobs";

/** A title on one line, short enough for a toast. */
export function oneLine(text: string | undefined): string | undefined {
	return text?.replace(/\s+/g, " ").slice(0, 80);
}

/**
 * What the filter matches. The id is searchable bare and with the hash, being the
 * handle shared with the JSON and CLI skills. Outcome tags are in here too, which is
 * how "ghosted" still finds its entries now it is a tag, not a column.
 */
function haystack(job: Job): string {
	const tags = outcomeTags(job)
		.map((t) => `${t.id} ${t.short}`)
		.join(" ");
	return `${job.company ?? ""} ${job.title ?? ""} ${job.notes ?? ""} #${job.id ?? ""} ${tags}`.toLowerCase();
}

export function filterJobs(
	jobs: Job[],
	query: string,
	fit: string | "all",
): Job[] {
	const q = query.trim().toLowerCase();
	return jobs.filter((job) => {
		if (fit !== "all" && job.fit !== fit) return false;
		return !q || haystack(job).includes(q);
	});
}

export type ByColumn = {
	/** The cards each column renders, in its own sort order. */
	map: Map<Status, Job[]>;
	/** Population before filtering, so a header can say a filter is hiding rows. */
	totals: Map<Status, number>;
};

/**
 * Counts off the whole board, lists off the filtered one, so a header still reads its
 * real population while a filter narrows the screen.
 */
export function groupByColumn(
	onBoard: Job[],
	filtered: Job[],
	sortFor: (status: Status) => SortId,
): ByColumn {
	const map = new Map<Status, Job[]>();
	const totals = new Map<Status, number>();
	for (const { status } of COLUMNS) {
		map.set(status, []);
		totals.set(status, 0);
	}
	for (const job of onBoard) {
		const col = columnOf(job);
		totals.set(col, (totals.get(col) ?? 0) + 1);
	}
	// Every column is seeded above, so the optional call is a formality.
	for (const job of filtered) map.get(columnOf(job))?.push(job);
	for (const [status, list] of map) list.sort(sorter(sortFor(status)));
	return { map, totals };
}
