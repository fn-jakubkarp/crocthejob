import type { Status } from "./status";

export type Lane = "intake" | "live" | "archive";

export type ColumnDef = {
	status: Status;
	label: string;
	lane: Lane;
	empty: string;
};

export const COLUMNS: ColumnDef[] = [
	{
		status: "new",
		label: "New",
		lane: "intake",
		empty: "nothing new since the last scrape",
	},
	{
		status: "ranked",
		label: "Ranked",
		lane: "intake",
		empty: "nothing scored and waiting",
	},
	{
		status: "applied",
		label: "Applied",
		lane: "live",
		empty: "no application out",
	},
	{
		status: "screening",
		label: "Screening",
		lane: "live",
		empty: "no recruiter call booked",
	},
	{
		status: "tech_interview",
		label: "Tech interview",
		lane: "live",
		empty: "no technical stage booked",
	},
	{
		status: "final_round",
		label: "Final round",
		lane: "live",
		empty: "no final round booked",
	},
	{
		status: "offer",
		label: "Offer",
		lane: "live",
		empty: "no offer on the table",
	},
	{
		status: "rejected",
		label: "Rejected",
		lane: "archive",
		empty: "no application has ended",
	},
	{
		status: "skipped",
		label: "Skipped",
		lane: "archive",
		empty: "nothing passed over",
	},
];

export const COLUMN_LABEL = {
	...Object.fromEntries(COLUMNS.map((c) => [c.status, c.label])),
	// The two folded statuses, labelled by where they land - see FOLDED.
	dismissed: "Skipped",
	expired: "Skipped",
} as Record<Status, string>;

/** Columns shown on a first run. */
export const DEFAULT_VISIBLE: Status[] = [
	"new",
	"ranked",
	"applied",
	"screening",
	"tech_interview",
	"final_round",
	"offer",
];

const LANE = new Map(COLUMNS.map((c) => [c.status, c.lane]));

/** The lane a column sits in. Folded statuses read as their column's lane. */
export function laneOf(status: Status): Lane {
	return LANE.get(status) ?? "archive";
}

/**
 * Stages the board asks a date for on the way in, so an application logged after the
 * fact says when it happened rather than claiming today.
 */
export const DATED_STAGES: Status[] = [
	"applied",
	"screening",
	"tech_interview",
	"final_round",
	"offer",
];

/** The stage date field each of those writes. */
export function stageDateField(status: Status): string {
	return status === "applied" ? "applied_date" : `${status}_date`;
}
