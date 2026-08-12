import { daysBetween, daysSince, stageAge, stageSince } from "./dates";
import { type ParsedLog, parseLog } from "./log";
import { columnOf, type Status } from "./status";
import type { Job } from "./types";

/**
 * One entry's own run, reconstructed from the dates it carries.
 *
 * Nothing logs events - the file holds dates, not a journal - so this can only say what
 * the entry actually recorded, and that is the whole discipline here. A stage with no
 * date is **left out**, never interpolated from its neighbours: an application that
 * jumped from Applied to Tech interview did not have a screening round, and inventing a
 * midpoint would make the funnel on the stats page disagree with this panel.
 *
 * `history.ts` reads the same dates across every entry and groups them by day, for "what
 * happened on Tuesday". This one is the other axis: one posting, start to finish.
 */

/**
 * The dated points in an entry's life, in pipeline order. `kind` is what the point is
 * called in the shared event vocabulary, so the log draws each leg in the colour and
 * glyph that stage has everywhere else in the app - see `EVENT` in `lib/strip.ts`.
 */
const POINTS = [
	{ field: "first_seen", label: "Seen", kind: "found" },
	{ field: "rank_date", label: "Ranked", kind: "ranked" },
	{ field: "applied_date", label: "Applied", kind: "applied" },
	{ field: "screening_date", label: "Screening", kind: "screening" },
	{
		field: "tech_interview_date",
		label: "Tech interview",
		kind: "tech_interview",
	},
	{ field: "final_round_date", label: "Final round", kind: "final_round" },
	{ field: "offer_date", label: "Offer", kind: "offer" },
	{ field: "rejected_date", label: "Closed", kind: "closed" },
] as const satisfies readonly {
	field: keyof Job;
	label: string;
	kind: EventKind;
}[];

export type Leg = {
	field: string;
	label: string;
	kind: EventKind;
	date: string;
	/** Days since the point before it. Null on the first, which has nothing to be since. */
	gap: number | null;
};

export type Timeline = {
	legs: Leg[];
	/**
	 * The wait in the stage the entry is in now: days, and whether that has run past
	 * the point where silence is worth chasing. Null anywhere off the live stages -
	 * a skipped posting is not waiting for anything.
	 */
	waiting: { days: number; stale: boolean } | null;
	/**
	 * Days from `applied_date` to the close, or to today while it is open. Null before
	 * an application goes out, which is when there is no process to measure yet.
	 */
	total: number | null;
};

export function buildTimeline(job: Job, now = new Date()): Timeline {
	const legs: Leg[] = POINTS.flatMap(({ field, label, kind }) => {
		const value = job[field];
		return typeof value === "string" && value
			? [{ field, label, kind, date: value, gap: null }]
			: [];
	})
		// By date, not by pipeline order: stage dates are hand-set and can be entered
		// out of sequence, and a run that reads top to bottom while its numbers go
		// backwards is worse than one that shows the order the dates claim. Ties keep
		// pipeline order, which is what `sort` being stable gives for free.
		.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

	for (let i = 1; i < legs.length; i++) {
		legs[i].gap = daysBetween(legs[i - 1].date, legs[i].date);
	}

	const since = stageSince(job);
	const age = since ? stageAge(since, columnOf(job), now) : null;

	const closed = job.rejected_date;
	const totalDays = job.applied_date
		? closed
			? daysBetween(job.applied_date, closed)
			: daysBetween(job.applied_date, iso(now))
		: null;

	return {
		legs,
		waiting: age ? { days: age.days, stale: age.stale } : null,
		// A negative total is a rejection dated before the application, which is a typo
		// in the file rather than a reading worth printing.
		total: totalDays !== null && totalDays >= 0 ? totalDays : null,
	};
}

/** Today as the file writes dates, in local time - the day the user is having. */
function iso(now: Date): string {
	const month = `${now.getMonth() + 1}`.padStart(2, "0");
	const day = `${now.getDate()}`.padStart(2, "0");
	return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * ── The rail ────────────────────────────────────────────────────────────────
 *
 * The same dates read as the pipeline rather than as a run. `buildTimeline` above answers
 * "where did the time go", which is a list of what happened; this answers "where does
 * this stand", which needs every stage present whether or not it happened. So the rule
 * inverts: here a stage with no date **keeps its slot and says so**, because the missing
 * date is the thing worth filling in, and a rail that redraws itself per entry is a rail
 * nobody can read across two entries.
 */

/** The pipeline, its label on the rail, and the field each stage takes its date from. */
const STEPS = [
	{ status: "new", label: "New", field: "first_seen" },
	{ status: "ranked", label: "Ranked", field: "rank_date" },
	{ status: "applied", label: "Applied", field: "applied_date" },
	{ status: "screening", label: "Screening", field: "screening_date" },
	{
		status: "tech_interview",
		label: "Tech interview",
		field: "tech_interview_date",
	},
	{ status: "final_round", label: "Final round", field: "final_round_date" },
	{ status: "offer", label: "Offer", field: "offer_date" },
] as const satisfies readonly {
	status: Status;
	label: string;
	field: keyof Job;
}[];

/** The seven stages the rail is made of, as a type: the pipeline, and nothing else. */
export type PipelineStage = (typeof STEPS)[number]["status"];

export type StageStep = {
	/**
	 * A pipeline stage, or one of the two endings. `buildStages` only ever returns the
	 * pipeline; the rail builds its ending slot in the same shape so one component
	 * draws all eight chevrons.
	 */
	status: PipelineStage | "rejected" | "skipped";
	label: string;
	/** What the file says, when it says anything. */
	date?: string;
	/** At or behind where the entry stands now. */
	reached: boolean;
	/** Where it stands now, and where a closed entry stopped. */
	current: boolean;
	/** Days from the previous dated stage. Null when either end has no date. */
	days: number | null;
	/**
	 * Which stage that count runs from. A joint sits between two chevrons but measures
	 * back to the last stage with a date, so when the one before it has none the two are
	 * not the same thing and the reading has to be able to say so.
	 */
	from?: string;
	/** Days until it happens, when the date is still ahead. */
	ahead: number | null;
};

const dateOf = (job: Job, field: keyof Job): string | undefined => {
	const value = job[field];
	return typeof value === "string" && ISO_DATE.test(value) ? value : undefined;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * How far it got is the later of where it stands and the last stage it has a date for: a
 * closed application is off the pipeline, and its dates are all it has left to say so.
 */
export function buildStages(job: Job, now = new Date()): StageStep[] {
	const current = columnOf(job);
	const standing = STEPS.findIndex((step) => step.status === current);
	const dated = STEPS.reduce(
		(last, step, i) => (dateOf(job, step.field) ? i : last),
		-1,
	);
	const reach = Math.max(standing, dated, 0);

	let previous: { date: string; label: string } | undefined;
	return STEPS.map((step, i) => {
		const date = dateOf(job, step.field);
		const since = date ? daysSince(date, now) : null;
		const days = date && previous ? daysBetween(previous.date, date) : null;
		const from = date && previous ? previous.label : undefined;
		if (date) previous = { date, label: step.label };
		return {
			status: step.status,
			label: step.label,
			date,
			reached: i <= reach,
			current: i === reach,
			days,
			from,
			ahead: since !== null && since < 0 ? -since : null,
		};
	});
}

/**
 * ── The log ─────────────────────────────────────────────────────────────────
 *
 * The legs above, plus the dated lines somebody kept by hand in `notes`, as one sequence.
 *
 * That log is the part of an application's history the file was never able to hold: the
 * recruiter who left, the call that got moved, the follow-up nobody answered. It went
 * into the note as `3 Jul: Screening` lines because there was nowhere else, and reading it
 * back is the difference between a list of stage dates and an account of what happened.
 * See `log.ts` - `notes` stays the source of truth and every write there rewrites one
 * line.
 *
 * TODAY IS A LINE ACROSS IT. A booked interview carries a date in the future, and every
 * reading in `dates.ts` returns null for one rather than printing a negative age. Those
 * split off as `upcoming` instead of being dropped: what is booked next is the most
 * consequential thing on a live application.
 */

export type EventKind =
	| "found"
	| "added"
	| "ranked"
	| "applied"
	| "screening"
	| "tech_interview"
	| "final_round"
	| "offer"
	| "closed"
	| "note";

export type JourneyEvent = {
	id: string;
	kind: EventKind;
	date: string;
	/** The coloured tag: what kind of thing this was. */
	tag: string;
	/** The words: a log line's own text, or what a derived event has to say. */
	text?: string;
	/** Days since the event below it, the older one. Null on the oldest, 0 same-day. */
	gap: number | null;
	/** Days until it happens. Set on upcoming events only. */
	ahead?: number;
	/** The `notes` line this came from, for the rows that can be rewritten. */
	line?: number;
};

export type Journey = {
	/** Dated ahead of today, soonest first. */
	upcoming: JourneyEvent[];
	/** Today and before, newest first. */
	past: JourneyEvent[];
	/** The note as parsed, so a row knows which line it writes back to. */
	log: ParsedLog;
};

/** What each leg is called on its chip. Shorter than the rail's label, which has room. */
const TAG: Record<EventKind, string> = {
	found: "found",
	added: "added",
	ranked: "ranked",
	applied: "applied",
	screening: "screening",
	tech_interview: "interview",
	final_round: "final round",
	offer: "offer",
	closed: "closed",
	note: "note",
};

/**
 * The pipeline as a running order, for the events that share a date. Least advanced
 * first, so reversing it is what puts an offer above the application on one day.
 */
const RANK = new Map<EventKind, number>(
	(
		[
			"found",
			"added",
			"ranked",
			"applied",
			"screening",
			"tech_interview",
			"final_round",
			"offer",
			"closed",
			"note",
		] as EventKind[]
	).map((kind, i) => [kind, i]),
);

const capitalise = (text: string) =>
	text.charAt(0).toUpperCase() + text.slice(1);

/** Portal slugs as they are said out loud. Anything unmapped prints its own slug. */
const PORTAL_NAME: Record<string, string> = {
	justjoinit: "justjoin.it",
	nofluffjobs: "No Fluff Jobs",
	linkedin: "LinkedIn",
	freehire: "Freehire",
	czyjesteldorado: "Czy jest eldorado",
};

/** Null for a hand-added entry, which came off no portal. */
export function portalLabel(portal: string | undefined): string | null {
	if (!portal || /^manual/i.test(portal)) return null;
	return portal
		.split("+")
		.map((part) => {
			const slug = part.trim().replace(/-search$/, "");
			return PORTAL_NAME[slug] ?? slug;
		})
		.join(" + ");
}

export function buildJourney(job: Job, now = new Date()): Journey {
	const log = parseLog(job.notes, { since: job.first_seen, now });
	const { legs } = buildTimeline(job, now);
	const events: JourneyEvent[] = [];

	for (const leg of legs) {
		// The sighting is the only leg that says something beyond its own name, and what
		// it says depends on whether a scraper or a person put the entry here.
		const portal = leg.kind === "found" ? portalLabel(job.portal) : null;
		const hand = leg.kind === "found" && !portal;
		const tags = leg.kind === "closed" ? outcomeWords(job) : undefined;
		events.push({
			id: leg.field,
			kind: hand ? "added" : leg.kind,
			date: leg.date,
			tag: hand ? TAG.added : TAG[leg.kind],
			text:
				leg.kind === "found"
					? (portal ?? "Added by hand")
					: leg.kind === "ranked" && job.rank_score != null
						? `Scored ${job.rank_score}${job.rank_verdict ? ` · ${job.rank_verdict}` : ""}`
						: tags,
			gap: null,
		});
	}

	for (const entry of log.entries) {
		events.push({
			id: `note:${entry.line}`,
			kind: "note",
			date: entry.date,
			tag: TAG.note,
			text: entry.text,
			gap: null,
			line: entry.line,
		});
	}

	const upcoming: JourneyEvent[] = [];
	const past: JourneyEvent[] = [];
	for (const event of events) {
		const since = daysSince(event.date, now);
		if (since !== null && since < 0) upcoming.push({ ...event, ahead: -since });
		else past.push(event);
	}

	/**
	 * Soonest first going forward, newest first going back: both read outward from now,
	 * which is where the reader is standing.
	 *
	 * Same date is the case that needs a rule, because the file has several - a posting
	 * found and screened on one day, an application and the note about it. The hand
	 * written line goes above the stamp: the note says what happened and the stage date is
	 * the bookkeeping that followed. Between two notes it is the order they were written,
	 * which is their order in the field, read whichever way the list runs.
	 */
	const sameDay = (a: JourneyEvent, b: JourneyEvent, newestFirst: boolean) => {
		const note = Number(b.kind === "note") - Number(a.kind === "note");
		if (note !== 0) return note;
		const order =
			a.kind === "note"
				? (a.line ?? 0) - (b.line ?? 0)
				: (RANK.get(a.kind) ?? 0) - (RANK.get(b.kind) ?? 0);
		return newestFirst ? -order : order;
	};
	upcoming.sort((a, b) => a.date.localeCompare(b.date) || sameDay(a, b, false));
	past.sort((a, b) => b.date.localeCompare(a.date) || sameDay(a, b, true));

	// The wait between one line and the one under it. On the oldest there is nothing to
	// measure from, which is a different reading from a same-day zero.
	for (let i = 0; i < past.length; i++) {
		const older = past[i + 1];
		past[i].gap = older ? daysBetween(older.date, past[i].date) : null;
	}

	return { upcoming, past, log };
}

/** How it ended, as the closing line's own words. Empty tags read as the plain answer. */
function outcomeWords(job: Job): string {
	const held = Array.isArray(job.outcome) ? job.outcome : [];
	return held.length
		? held.map((tag) => capitalise(tag.replace(/_/g, " "))).join(" · ")
		: "They said no";
}
