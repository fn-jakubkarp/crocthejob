import { staleAfterMove } from "@jobsearch/jobs-data";
import type { Job, JobChanges } from "./types";

export const STATUSES = [
	"new",
	"ranked",
	"applied",
	"screening",
	"tech_interview",
	"final_round",
	"offer",
	// Every ending short of an offer, silence and withdrawal included. Which one is in
	// `outcome`, not the status - see OUTCOMES.
	"rejected",
	"skipped",
	// Read, never written any more: both fold into `skipped`. See FOLDED.
	"dismissed",
	"expired",
] as const;

export type Status = (typeof STATUSES)[number];

/**
 * Statuses sharing a column. Still written - `expired` by /rank, `dismissed` by older
 * board versions - but closed, passed over and ruled out are one place to the board;
 * the reason lives in `notes` or `excluded_reason`. The board writes `skipped` now.
 */
const FOLDED: Partial<Record<Status, Status>> = {
	dismissed: "skipped",
	expired: "skipped",
};

/**
 * Statuses the tracker and CLI skills still write. Read, never written here: without
 * this they fall through `columnOf` into New, putting a dead application back in the
 * intake queue.
 */
export const LEGACY_STATUS: Record<string, Status> = {
	ghosted: "rejected",
	withdrawn: "rejected",
};

export function isStatus(value: string | undefined | null): value is Status {
	return !!value && (STATUSES as readonly string[]).includes(value);
}

/** A retired status maps to its replacement; anything else parks in "new". */
export function columnOf(job: Job): Status {
	if (isStatus(job.status)) return FOLDED[job.status] ?? job.status;
	return (job.status && LEGACY_STATUS[job.status]) || "new";
}

/**
 * The entry as it will read once the server has applied `changes`. Not a plain spread,
 * because a move back down the pipeline *removes* the stage dates above it - see
 * `staleAfterMove` - and a spread can only add. Without this the card holds the date it
 * just cleared until the next reload, and the history page keeps printing the stage that
 * never happened.
 */
export function merged(job: Job, changes: JobChanges): Job {
	const next: Job = { ...job, ...changes };
	if (changes.status && changes.status !== job.status) {
		for (const field of staleAfterMove(job, changes.status, changes)) {
			delete (next as Record<string, unknown>)[field];
		}
	}
	return next;
}

/** How each writable shape says "nothing"; anything else empties to "". */
const EMPTY: Record<string, unknown> = { outcome: [], duplicate_of: null };

/**
 * The write that puts an entry back as `changes` found it - what the Undo on the toast
 * sends. Every field the write named, plus the stage dates a move down the pipeline
 * cleared: naming those explicitly is also what protects them on the way back, since
 * `apply` clears nothing a write sets by hand.
 */
export function inverse(job: Job, changes: JobChanges): JobChanges {
	const fields = new Set(Object.keys(changes));
	if (changes.status && changes.status !== job.status) {
		for (const field of staleAfterMove(job, changes.status, changes)) {
			fields.add(field);
		}
	}

	const back: Record<string, unknown> = {};
	for (const field of fields) {
		const was = (job as Record<string, unknown>)[field];
		back[field] = was ?? (field in EMPTY ? EMPTY[field] : "");
	}
	// The server refuses "" as a status, and an entry the file left without one reads
	// under New - which is where undoing its first move belongs.
	if (fields.has("status")) back.status = job.status ?? "new";

	return back as JobChanges;
}
