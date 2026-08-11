/**
 * The shape of data/jobs.json and of a write against it. Data only: no file access, no
 * validation, no HTTP.
 */

export const STATUSES = [
	"new",
	"ranked",
	"applied",
	"screening",
	"tech_interview",
	"final_round",
	"offer",
	"rejected",
	"skipped",
	"dismissed",
	"expired",
] as const;

export type Status = (typeof STATUSES)[number];

/**
 * The pipeline in order, so the index is how far an entry has got. `skipped` and the
 * folded statuses are deliberately absent: passing a posting over is not a position on
 * the pipeline, it is a decision not to be on it.
 */
export const PIPELINE = [
	"new",
	"ranked",
	"applied",
	"screening",
	"tech_interview",
	"final_round",
	"offer",
] as const;

/** The date each pipeline stage writes. The two intake stages write none. */
export const STAGE_DATE: Partial<Record<Status, string>> = {
	applied: "applied_date",
	screening: "screening_date",
	tech_interview: "tech_interview_date",
	final_round: "final_round_date",
	offer: "offer_date",
};

export const OUTCOMES = [
	"ghosted",
	"withdrawn",
	"on_hold",
	"declined",
	"auto_rejected",
	"failed_screening",
	"failed_tech",
	"failed_behavioural",
] as const;

/** Statuses read and translated, never written: the tag carries what they said. */
export const LEGACY_STATUS: Record<
	string,
	{ status: Status; outcome: string }
> = {
	ghosted: { status: "rejected", outcome: "ghosted" },
	withdrawn: { status: "rejected", outcome: "withdrawn" },
};

export type JobEntry = {
	title?: string;
	company?: string;
	url?: string;
	first_seen?: string;
	fit?: string;
	status?: string;
	portal?: string;
	/** Repo-relative path to the saved posting text. /scrape writes it. */
	posting_file?: string;
	notes?: string;
	rank_score?: number;
	rank_verdict?: string;
	rank_date?: string;
	id?: number;
	status_date?: string;
	/** The day the board last wrote anything to this entry. See `apply`. */
	last_updated?: string;
	applied_date?: string;
	duplicate_of?: string | null;
	outcome?: string[];
	[key: string]: unknown;
};

/** The `portal` a hand-added entry carries; /scrape writes a portal slug instead. */
export const MANUAL_PORTAL = "manual (user)";

/**
 * Whether the entry was typed in rather than scraped. The one entry a delete may touch:
 * anything /scrape found comes back on the next run, so removing it is theatre.
 */
export function isManual(entry: Pick<JobEntry, "portal">): boolean {
	return /^manual/i.test(entry.portal ?? "");
}

export type JobsFile = {
	next_id?: number;
	seen: Record<string, JobEntry>;
};

export type Changes = {
	status?: string;
	notes?: string;
	duplicate_of?: string | null;
	outcome?: string[];
	addOutcome?: string;
	title?: string;
	company?: string;
	url?: string;
	work_mode?: string;
	salary?: string;
	rank_location?: string;
	portal?: string;
	excluded_reason?: string;
	applied_date?: string;
	screening_date?: string;
	tech_interview_date?: string;
	final_round_date?: string;
	offer_date?: string;
	rejected_date?: string;
	posted?: string;
	first_seen?: string;
	rank_deadline?: string;
};

/** Free-text fields the edit dialog may rewrite, all validated the same way. */
export const TEXT_FIELDS = [
	"work_mode",
	"salary",
	"rank_location",
	"portal",
	"excluded_reason",
] as const;

/**
 * `ahead` is whether a future date is legitimate. A stage that gets booked ahead of
 * time - a call, an interview, an offer discussion - can honestly carry one; `applied`,
 * `rejected`, `posted` and `first_seen` name something that already happened.
 */
export const DATE_FIELDS = [
	{ field: "applied_date", ahead: false },
	{ field: "screening_date", ahead: true },
	{ field: "tech_interview_date", ahead: true },
	{ field: "final_round_date", ahead: true },
	{ field: "offer_date", ahead: true },
	{ field: "rejected_date", ahead: false },
	{ field: "posted", ahead: false },
	{ field: "first_seen", ahead: false },
	{ field: "rank_deadline", ahead: true },
] as const;
