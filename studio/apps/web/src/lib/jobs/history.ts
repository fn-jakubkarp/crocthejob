import { outcomeTags } from "./outcomes";
import { scoreLamp } from "./scoring";
import { columnOf, type Status } from "./status";
import type { Job } from "./types";

/**
 * The search as it happened, day by day.
 *
 * Nothing logs events here: the file holds dates, not a journal, so the timeline is
 * reconstructed from them. That sets what it can honestly say. A stage date is one
 * posting moving, so it gets a line of its own. An intake date is a scrape run, which
 * touched a hundred postings in one go and is one thing that happened, so it is one
 * line with a count on it. The rule throughout: one line per action taken, never per
 * row written.
 */

export type HistoryKind =
	| "found"
	| "added"
	| "ranked"
	| "applied"
	| "screening"
	| "tech_interview"
	| "final_round"
	| "offer"
	| "closed";

export type HistoryEvent = {
	id: string;
	kind: HistoryKind;
	date: string;
	/** The coloured tag: what kind of thing happened. Uppercased by the page. */
	tag: string;
	/** The bold noun: a company, or the portal a batch came off. */
	lead?: string;
	/** The data face: a count, or the role. */
	object?: string;
	/** Trailing note on the line: how it ended, what a pass scored, which portals. */
	detail?: string;
	/** A glyph the detail earns. Only ending: silence gets the ghost. */
	mark?: "ghost";
	/** Postings this line accounts for. 1 for everything but a batch. */
	count: number;
	/** Where those postings sit now, when opening the column means anything. */
	status?: Status;
};

export type HistoryDay = {
	date: string;
	/** "Today", "Yesterday", or `Wed 5 Aug`. */
	label: string;
	/** How long ago that was: "today", "1d", "12d". */
	age: string;
	events: HistoryEvent[];
	/** Postings the day's lines account for, which is not the number of lines. */
	count: number;
};

/** Stage dates, each one posting moving one step. Pipeline order. */
const STAGES = [
	{ field: "applied_date", kind: "applied", tag: "applied" },
	{ field: "screening_date", kind: "screening", tag: "screening" },
	{
		field: "tech_interview_date",
		kind: "tech_interview",
		tag: "interview",
	},
	{ field: "final_round_date", kind: "final_round", tag: "final round" },
	{ field: "offer_date", kind: "offer", tag: "offer" },
] as const satisfies readonly {
	field: keyof Job;
	kind: HistoryKind;
	tag: string;
}[];

/**
 * Within a day the order is the pipeline's, not the file's: an offer outranks a scrape
 * run on the same date, and no timestamp exists to argue otherwise.
 */
const KIND_ORDER: HistoryKind[] = [
	"offer",
	"final_round",
	"tech_interview",
	"screening",
	"applied",
	"closed",
	"ranked",
	"added",
	"found",
];

const RANK = new Map(KIND_ORDER.map((kind, i) => [kind, i]));

/** Portal slugs as they are said out loud. Anything unmapped prints its own slug. */
const PORTAL_NAME: Record<string, string> = {
	justjoinit: "justjoin.it",
	nofluffjobs: "No Fluff Jobs",
	linkedin: "LinkedIn",
	freehire: "Freehire",
	czyjesteldorado: "Czy jest eldorado",
};

/** Null for a hand-added entry, which came off no portal. */
function portalLabel(portal: string | undefined): string | null {
	if (!portal || /^manual/i.test(portal)) return null;
	return portal
		.split("+")
		.map((part) => {
			const slug = part.trim().replace(/-search$/, "");
			return PORTAL_NAME[slug] ?? slug;
		})
		.join(" + ");
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;
const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function iso(value: unknown): string | null {
	return typeof value === "string" && ISO.test(value) ? value : null;
}

/** From the parts, not `new Date(iso)`: west of UTC that reads the day before. */
function utcDay(day: string): number {
	return Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
}

/**
 * The day's own heading. It carries the age too, because the lines under it no longer
 * do: every one of them happened on this date, so stamping each with the same "12 days
 * ago" was a column of the same figure repeated down the page.
 */
function dayHead(day: string, today: number): { label: string; age: string } {
	const days = Math.round((today - utcDay(day)) / DAY);
	const age = days === 0 ? "today" : `${days}d`;
	if (days === 0) return { label: "Today", age };
	if (days === 1) return { label: "Yesterday", age };
	const date = new Date(utcDay(day));
	const head = `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
	// The year only earns its place once the run spans one.
	return {
		label:
			date.getUTCFullYear() === new Date(today).getUTCFullYear()
				? head
				: `${head} ${date.getUTCFullYear()}`,
		age,
	};
}

const plural = (count: number, noun: string) =>
	`${count} ${noun}${count === 1 ? "" : "s"}`;

const capitalise = (text: string) =>
	text.charAt(0).toUpperCase() + text.slice(1);

const nameOf = (job: Job) => job.company ?? job.title ?? "Untitled";

/** How many postings each portal turned up on one day. */
type Sweep = Map<string, number>;

const tally = <K>(map: Map<K, number>, key: K) =>
	map.set(key, (map.get(key) ?? 0) + 1);

/** `justjoin.it 112 · LinkedIn 37 · No Fluff Jobs 44` — busiest first, then the rest. */
function sweepDetail(sweep: Sweep): string {
	const portals = [...sweep.entries()].sort((a, b) => b[1] - a[1]);
	const named = portals
		.slice(0, 3)
		.map(([name, count]) => `${name} ${count}`)
		.join(" · ");
	const rest = portals.length - 3;
	return rest > 0 ? `${named} · +${rest} more` : named;
}

export function buildHistory(jobs: Job[], now = new Date()): HistoryDay[] {
	const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
	const events: HistoryEvent[] = [];

	// Intake, one line per day - not one per portal. A scrape is a single thing the
	// owner did, and it sweeps every portal in one go; which ones it hit, and how many
	// each turned up, is detail on that one line. Hand-added entries stay separate:
	// typing an entry in is the owner's own action, not the scraper's.
	const swept = new Map<string, Sweep>();
	const added = new Map<string, number>();
	// Count and scores apart: a posting can carry a rank_date with no score on it, and
	// it was still ranked that day.
	const ranked = new Map<string, { count: number; scores: number[] }>();
	for (const job of jobs) {
		const seen = iso(job.first_seen);
		if (seen) {
			const portal = portalLabel(job.portal);
			if (portal) {
				const sweep = swept.get(seen) ?? new Map<string, number>();
				tally(sweep, portal);
				swept.set(seen, sweep);
			} else tally(added, seen);
		}
		const scored = iso(job.rank_date);
		if (scored) {
			const pass = ranked.get(scored) ?? { count: 0, scores: [] };
			pass.count += 1;
			if (job.rank_score != null) pass.scores.push(job.rank_score);
			ranked.set(scored, pass);
		}
	}

	for (const [date, sweep] of swept) {
		const count = [...sweep.values()].reduce((sum, n) => sum + n, 0);
		events.push({
			id: `found:${date}`,
			kind: "found",
			date,
			tag: "found",
			lead: plural(count, "posting"),
			detail: sweepDetail(sweep),
			count,
		});
	}

	for (const [date, count] of added) {
		events.push({
			id: `added:${date}`,
			kind: "added",
			date,
			tag: "added",
			lead: plural(count, "posting"),
			detail: "Added by hand",
			count,
		});
	}

	for (const [date, pass] of ranked) {
		// What a pass is worth is its top of the pile and how much of it cleared the
		// apply line, not the span of the scores - a range said nothing a reader could
		// act on. "Worth applying to" is `scoreLamp`'s own high band, so the figure here
		// and a green lamp on the board are the same claim.
		const top = Math.max(...pass.scores, 0);
		const worth = pass.scores.filter(
			(score) => scoreLamp(score) === "high",
		).length;
		events.push({
			id: `ranked:${date}`,
			kind: "ranked",
			date,
			tag: "ranked",
			lead: plural(pass.count, "posting"),
			detail: pass.scores.length
				? `Top score ${top}${worth > 0 ? ` · ${worth} worth applying to` : ""}`
				: undefined,
			count: pass.count,
		});
	}

	for (const job of jobs) {
		const status = columnOf(job);

		for (const stage of STAGES) {
			const date = iso(job[stage.field]);
			if (!date) continue;
			events.push({
				id: `${stage.kind}:${job.key}`,
				kind: stage.kind,
				date,
				tag: stage.tag,
				lead: nameOf(job),
				object: job.company ? job.title : undefined,
				count: 1,
				status,
			});
		}

		// An ending, only where the file can date one. `status_date` is the day the row
		// was moved, which for a closed application is the day it closed; on anything
		// still live it is just the last time the card was touched, so it says nothing.
		const closed =
			status === "rejected" && iso(job.rejected_date ?? job.status_date);
		if (closed) {
			const tags = outcomeTags(job);
			events.push({
				id: `closed:${job.key}`,
				kind: "closed",
				date: closed,
				tag: "closed",
				lead: nameOf(job),
				object: job.company ? job.title : undefined,
				detail: tags.length
					? tags.map((tag) => capitalise(tag.short)).join(" · ")
					: "They said no",
				mark: tags.some((tag) => tag.id === "ghosted") ? "ghost" : undefined,
				count: 1,
				status,
			});
		}
	}

	const byDay = new Map<string, HistoryEvent[]>();
	for (const event of events) {
		const day = byDay.get(event.date);
		if (day) day.push(event);
		else byDay.set(event.date, [event]);
	}

	return [...byDay.entries()]
		.sort((a, b) => b[0].localeCompare(a[0]))
		.map(([date, list]) => ({
			date,
			...dayHead(date, today),
			events: list.sort(
				(a, b) =>
					(RANK.get(a.kind) ?? 0) - (RANK.get(b.kind) ?? 0) ||
					(a.lead ?? "").localeCompare(b.lead ?? ""),
			),
			count: list.reduce((sum, event) => sum + event.count, 0),
		}));
}
