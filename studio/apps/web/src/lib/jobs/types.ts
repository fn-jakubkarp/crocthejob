import type { OutcomeId } from "./outcomes";
import type { Status } from "./status";

export type Job = {
	key: string;
	/**
	 * Assigned once by the dev-server, never reused. Optional only in case a fetch
	 * beats the backfill; every entry in the file carries one.
	 */
	id?: number;
	title?: string;
	company?: string;
	url?: string;
	first_seen?: string;
	/** The day `status` last changed. Absent on entries predating the field. */
	status_date?: string;
	/**
	 * The day the board last wrote anything here - a note and a corrected field count,
	 * which `status_date` does not. Stamped by the server on every write, so an entry
	 * nobody has touched since the stamp existed carries none.
	 */
	last_updated?: string;
	/**
	 * Set by hand. Separate from `status_date`, which is only ever today: an
	 * application logged after the fact must say when it happened.
	 */
	applied_date?: string;
	screening_date?: string;
	tech_interview_date?: string;
	final_round_date?: string;
	offer_date?: string;
	rejected_date?: string;
	/**
	 * The entry this is a copy of. Absent = not yet judged; `null` = read and ruled
	 * standalone. Hence the two are distinct.
	 */
	duplicate_of?: string | null;
	/** See OUTCOMES; empty or absent reads as "they said no". */
	outcome?: string[];
	fit?: string;
	status?: string;
	portal?: string;
	notes?: string;
	rank_score?: number;
	rank_verdict?: string;
	rank_date?: string;
	rank_deadline?: string;
	rank_location?: string;
	/** /scrape's and /rank's free text; rendered verbatim, never parsed. */
	excluded_reason?: string;
	/**
	 * Repo-relative path to the posting text /scrape saved, under
	 * `documents/postings/`. Absent means nothing was saved for this entry - the only
	 * existence check there is, so a deleted file reads as a failed open.
	 */
	posting_file?: string;
	work_mode?: string;
	salary?: string;
	posted?: string;
	rank_location_note?: string;
	rank_dimensions?: Partial<
		Record<"technical" | "experience" | "behavioral" | "career", number>
	>;
};

/** What the board may write. Everything else belongs to /scrape and /rank. */
export type JobChanges = {
	status?: Status;
	notes?: string;
	/** A canonical key, or null for "checked, standalone". */
	duplicate_of?: string | null;
	/** The full tag set, not a delta. Empty array removes the field. */
	outcome?: OutcomeId[];
	/* The edit dialog's fields. `fit` and `rank_*` stay out - /scrape's and /rank's
	   conclusions. "" removes the field, except on the required `title`/`company`. */
	title?: string;
	company?: string;
	url?: string;
	work_mode?: string;
	salary?: string;
	applied_date?: string;
	screening_date?: string;
	tech_interview_date?: string;
	final_round_date?: string;
	offer_date?: string;
	rejected_date?: string;
	/** The place, not a verdict - see `locationOf`. */
	rank_location?: string;
	rank_deadline?: string;
	posted?: string;
	first_seen?: string;
	portal?: string;
	excluded_reason?: string;
};

/** What a hand-added entry may set. The rest is the server's to fill. */
export type NewJob = {
	title: string;
	company: string;
	url?: string;
	work_mode?: string;
	salary?: string;
	applied_date?: string;
	screening_date?: string;
	tech_interview_date?: string;
	final_round_date?: string;
	offer_date?: string;
	rejected_date?: string;
	notes?: string;
	status?: Status;
};
