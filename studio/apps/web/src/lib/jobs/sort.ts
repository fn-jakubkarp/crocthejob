import type { Lane } from "./columns";
import { fitRank } from "./scoring";
import type { Job } from "./types";

export const SORTS = [
	{ id: "updated_desc", label: "Date updated, newest first" },
	{ id: "status_date_asc", label: "Wait time, longest first" },
	{ id: "score", label: "Score, highest first" },
	{ id: "fit", label: "Fit, best first" },
	{ id: "deadline", label: "Deadline, soonest first" },
	{ id: "outcome", label: "Outcome type" },
	{ id: "company", label: "Company, A-Z" },
] as const;

export type SortId = (typeof SORTS)[number]["id"];

const SORT_IDS = new Set<string>(SORTS.map((s) => s.id));

/**
 * A sort this build still offers. localStorage outlives a rename, and an id nothing
 * matches falls through `sorter`'s switch to `undefined` - which sorts the column by
 * whatever `Array.sort` makes of two objects.
 */
export const isSortId = (value: unknown): value is SortId =>
	typeof value === "string" && SORT_IDS.has(value);

/** Which sorts a lane offers. A column reads one bucket; nothing filters SORTS. */
const LANE_SORT_IDS: Record<Lane, readonly SortId[]> = {
	intake: ["score", "fit", "deadline", "updated_desc", "company"],
	live: ["updated_desc", "status_date_asc", "score", "company"],
	archive: ["updated_desc", "outcome", "company"],
};

const laneSorts: Record<Lane, (typeof SORTS)[number][]> = {
	intake: [],
	live: [],
	archive: [],
};
for (const sort of SORTS)
	for (const lane of ["intake", "live", "archive"] as const)
		if (LANE_SORT_IDS[lane].includes(sort.id)) laneSorts[lane].push(sort);

/** The menu each lane shows, in SORTS order, settled once at module load. */
export const LANE_SORTS: Record<Lane, readonly (typeof SORTS)[number][]> =
	laneSorts;

/**
 * Sorts reading a value only an intake card carries. An archived entry has no live
 * score, fit or deadline to order by, so archive columns fall back to the archived
 * date - for the default and for a sort picked while the column was intake.
 */
const INTAKE_SORTS: readonly SortId[] = ["score", "fit", "deadline"];

/**
 * What a column sorts by until the user says otherwise. Intake alone leads with the
 * score: triage reads a fresh scrape by how well it fits, and nothing there has been
 * touched yet anyway. Past that the question is what moved last.
 */
function defaultSort(lane: Lane): SortId {
	return lane === "intake" ? "score" : "updated_desc";
}

/** The sort a column applies, given the one the user picked. */
export function effectiveSort(lane: Lane, chosen?: SortId): SortId {
	const sort = chosen ?? defaultSort(lane);
	return lane === "archive" && INTAKE_SORTS.includes(sort)
		? "updated_desc"
		: sort;
}

/** Entries with no deadline sort last. */
const deadlineKey = (j: Job) => j.rank_deadline || "9999-99-99";

/**
 * When the entry itself last moved. `last_updated` is the honest answer and covers a
 * note or a corrected field; `status_date` is the fallback for everything written
 * before the board stamped it, and `first_seen` for what predates even that. Without
 * the chain every unstamped entry ties at the bottom in scrape order.
 */
const updatedKey = (j: Job) =>
	j.last_updated ?? j.status_date ?? j.first_seen ?? "";

export function sorter(sort: SortId): (a: Job, b: Job) => number {
	switch (sort) {
		case "updated_desc":
			return (a, b) => updatedKey(b).localeCompare(updatedKey(a));
		case "status_date_asc":
			return (a, b) => (a.status_date ?? "").localeCompare(b.status_date ?? "");
		case "score":
			return (a, b) =>
				(b.rank_score ?? -1) - (a.rank_score ?? -1) || fitRank(a) - fitRank(b);
		case "fit":
			return (a, b) =>
				fitRank(a) - fitRank(b) || (b.rank_score ?? -1) - (a.rank_score ?? -1);
		case "deadline":
			return (a, b) => deadlineKey(a).localeCompare(deadlineKey(b));
		case "outcome":
			return (a, b) => {
				const aOut = a.outcome?.[0] ?? "z_rejected"; // default rejected goes last
				const bOut = b.outcome?.[0] ?? "z_rejected";
				return aOut.localeCompare(bOut);
			};
		case "company":
			return (a, b) => (a.company ?? "").localeCompare(b.company ?? "");
	}
}
