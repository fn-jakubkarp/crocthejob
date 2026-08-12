import { columnOf, type Status } from "./status";
import type { Job } from "./types";

/**
 * Today, as the person looking at it would write it. From the local parts, not
 * `toISOString()`: east of UTC that reads yesterday for the first hours of every day,
 * which is exactly when a log entry gets typed.
 */
export function todayISO(now = new Date()): string {
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${now.getFullYear()}-${month}-${day}`;
}

/** `2026-09-22` → `09-22`. */
export function shortDate(iso: string): string {
	return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.slice(5) : iso;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * ISO date as a UTC day number, or null. From the parts, not `new Date(iso)`: west
 * of UTC that reads yesterday's deadline as today's.
 */
function utcDay(iso: string): number | null {
	const m = ISO.exec(iso);
	return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
}

function startOfToday(now: Date): number {
	return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

const DAY = 86_400_000;

type DeadlineRead = { text: string; state: "far" | "soon" | "lapsed" };

/** Days until a deadline; negative once it has passed, null on a date that is not one. */
export function dueInDays(iso: string, now = new Date()): number | null {
	const due = utcDay(iso);
	return due === null ? null : Math.round((due - startOfToday(now)) / DAY);
}

export function deadlineRead(iso: string, now = new Date()): DeadlineRead {
	const days = dueInDays(iso, now);
	if (days === null) return { text: iso, state: "far" };
	if (days < 0) return { text: `lapsed ${shortDate(iso)}`, state: "lapsed" };
	if (days === 0) return { text: "due today", state: "soon" };
	if (days <= 7) return { text: `due in ${days}d`, state: "soon" };
	return { text: `due ${shortDate(iso)}`, state: "far" };
}

/** The stages where the wait is the story. */
const LIVE_STAGES = new Set<Status>([
	"applied",
	"screening",
	"tech_interview",
	"final_round",
	"offer",
]);

/**
 * After this many days without a word, silence is the story and the wait is worth a
 * chase. Per stage, because a live process goes cold faster than a cold application:
 * three weeks after applying is ordinary, three weeks after a recruiter call is not.
 *
 * A stage left out is never chased - an offer on the table is theirs to wait on.
 */
const CHASE_DAYS: Partial<Record<Status, number>> = {
	applied: 21,
	screening: 14,
	tech_interview: 14,
	final_round: 14,
};

/**
 * Days past the point where the wait turns into a thing to do - the test, and the sort
 * key wherever waits are ordered. Zero or less is a wait that is not due yet; `null` is
 * a stage that is never chased at all, which is a different thing from a wait at zero.
 */
export function overdueBy(days: number, status: Status): number | null {
	const limit = CHASE_DAYS[status];
	return limit === undefined ? null : days - limit;
}

type StageAge = {
	/** Days since the stamp; `0` is today. */
	days: number;
	/** "today" or "12d". */
	text: string;
	stale: boolean;
};

/**
 * Whole days from one ISO date to another, or null if either is not one. Negative
 * when `to` is the earlier of the two, which is a real answer: hand-set stage dates
 * can be entered out of order, and smoothing that to zero would hide it.
 */
export function daysBetween(from: string, to: string): number | null {
	const a = utcDay(from);
	const b = utcDay(to);
	return a === null || b === null ? null : Math.round((b - a) / DAY);
}

/**
 * Days from today, signed. Negative is a date in the future, which is how a booked
 * interview reads - and the one thing `elapsed` below deliberately refuses to say, since
 * every *age* on a card would otherwise print a negative number.
 */
export function daysSince(iso: string, now = new Date()): number | null {
	const day = utcDay(iso);
	return day === null ? null : Math.round((startOfToday(now) - day) / DAY);
}

/** Days since an ISO date, or null for a bad or future one. */
function elapsed(iso: string, now: Date): number | null {
	const since = utcDay(iso);
	if (since === null) return null;
	const days = Math.round((startOfToday(now) - since) / DAY);
	return days < 0 ? null : days;
}

/**
 * How long a live application has sat where it is. No stage word in the text:
 * "interview today" read as a scheduled interview, not as entering the stage today,
 * and the column already names the stage.
 */
export function stageAge(
	iso: string,
	status: Status,
	now = new Date(),
): StageAge | null {
	if (!LIVE_STAGES.has(status)) return null;
	const days = elapsed(iso, now);
	if (days === null) return null;
	return {
		days,
		text: days === 0 ? "today" : `${days}d`,
		stale: (overdueBy(days, status) ?? 0) > 0,
	};
}

export function postedAge(iso: string, now = new Date()): string {
	const days = elapsed(iso, now);
	if (days === null) return iso;
	if (days === 0) return "today";
	if (days === 1) return "1 day ago";
	return `${days} days ago`;
}

/**
 * Which date a card ages from. The hand-set stage date beats the `status_date`
 * stamp - the former is the day it happened, the latter the day it was dragged.
 * `applied_date` is the fallback for entries predating the stamp.
 */
export function stageSince(job: Job): string | undefined {
	switch (columnOf(job)) {
		case "applied":
			return job.applied_date ?? job.status_date;
		case "screening":
			return job.screening_date ?? job.status_date ?? job.applied_date;
		case "tech_interview":
			return job.tech_interview_date ?? job.status_date ?? job.applied_date;
		case "final_round":
			return job.final_round_date ?? job.status_date ?? job.applied_date;
		case "offer":
			return job.offer_date ?? job.status_date ?? job.applied_date;
		default:
			return job.status_date ?? job.applied_date;
	}
}

/**
 * The earliest date the entry carries, which is what "how long have I been at this one"
 * means. `applied_date` alone cannot answer it: most entries never get one, and an
 * application logged without a date read as having taken no time at all.
 *
 * `posted` is deliberately out: that is the day the employer published, not the day this
 * became one of ours.
 */
export function processSince(job: Job): string | undefined {
	const dates = [job.first_seen, job.applied_date, job.rank_date].filter(
		(date): date is string => typeof date === "string" && ISO.test(date),
	);
	return dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : undefined;
}

/** Days since an ISO date, for callers that want the count rather than a phrase. */
export function daysElapsed(iso: string, now = new Date()): number | null {
	return elapsed(iso, now);
}

/**
 * Total time since `applied_date`. On the Applied column it duplicates `stageAge`,
 * so callers compare the two and skip this when they match.
 */
export function processAge(job: Job, now = new Date()): StageAge | null {
	if (!job.applied_date) return null;
	const days = elapsed(job.applied_date, now);
	if (days === null) return null;
	return { days, text: days === 0 ? "today" : `${days}d`, stale: false };
}
