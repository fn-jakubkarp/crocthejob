import { COLUMN_LABEL } from "./columns";
import { dueInDays, overdueBy } from "./dates";
import { type OutcomeId, outcomeTags } from "./outcomes";
import { scoreLamp } from "./scoring";
import { columnOf, type Status } from "./status";
import type { Job } from "./types";

/**
 * Every reading the stats page takes, in one pure pass. No React and no fetching, so
 * what each number means is readable in one file and testable without a DOM.
 *
 * The population is postings, never entries: the caller drops duplicate copies before
 * calling, so these figures reconcile with the board's own counts.
 */

/** Stages the funnel reports, in pipeline order. `seen` is the whole population. */
const FUNNEL_STAGES = [
	"ranked",
	"applied",
	"screening",
	"tech_interview",
	"final_round",
	"offer",
] as const satisfies readonly Status[];

/**
 * An outcome tag is evidence a posting reached a stage: an application that failed the
 * technical got as far as the technical, whether or not a date was ever typed in.
 * `failed_behavioural` counts as the technical stage because it sits after it in
 * OUTCOMES, which is the only ordering the tags carry.
 */
const TAG_REACH: Partial<Record<OutcomeId, Status>> = {
	failed_screening: "screening",
	failed_tech: "tech_interview",
	failed_behavioural: "tech_interview",
};

const STAGE_RANK = new Map<Status, number>(
	FUNNEL_STAGES.map((status, i) => [status, i]),
);

/**
 * Columns that prove an application went out. `ranked` is deliberately absent even
 * though it is a funnel stage: a scored posting in the queue has been read, not
 * applied to.
 */
const APPLIED_COLUMNS = new Set<Status>([
	"applied",
	"screening",
	"tech_interview",
	"final_round",
	"offer",
	"rejected",
]);

/** The intake queue: read or not, nothing has been decided about these yet. */
const QUEUED = new Set<Status>(["new", "ranked"]);

/**
 * The furthest stage a posting can be shown to have reached, as an index into
 * FUNNEL_STAGES, or -1 for one that never got scored.
 *
 * Read from three independent kinds of evidence, because a terminal status alone
 * cannot say how far a dead application got: the column it sits in, the hand-set stage
 * dates, and the outcome tags. `rejected` is the case that needs all three - it is
 * every ending short of an offer, so it proves an application went out and nothing
 * more.
 */
function reachOf(job: Job): number {
	const column = columnOf(job);
	let reach = -1;

	const bump = (status: Status) => {
		const rank = STAGE_RANK.get(status);
		if (rank !== undefined && rank > reach) reach = rank;
	};

	if (job.rank_score != null || column !== "new") bump("ranked");
	// Skipped is a posting passed over, never an application, so it stops at ranked.
	if (column === "skipped") return reach;

	if (APPLIED_COLUMNS.has(column)) bump("applied");
	if (STAGE_RANK.has(column)) bump(column);

	if (job.applied_date) bump("applied");
	if (job.screening_date) bump("screening");
	if (job.tech_interview_date) bump("tech_interview");
	if (job.final_round_date) bump("final_round");
	if (job.offer_date) bump("offer");

	for (const tag of outcomeTags(job)) {
		const stage = TAG_REACH[tag.id];
		if (stage) bump(stage);
	}

	return reach;
}

export type FunnelStage = {
	/** The column this row opens, or null for the whole population. */
	status: Status | null;
	label: string;
	reached: number;
	/** Share of the whole population, which is what the meter draws. */
	ofSeen: number;
	/** Share of the stage above, which is the drop-off. Null on the first row. */
	ofPrevious: number | null;
};

/**
 * Where the file sits *now*, which is the one thing the funnel cannot say: it reports
 * how far each posting ever got, so a posting passed over and a posting still queued
 * both count as "ranked" there and are opposite things here.
 *
 * Four groups rather than eight columns, because a dial with eight arcs is a legend
 * with a picture attached. Every column belongs to exactly one group, so the four
 * always total the population.
 */
const MIX: {
	id: string;
	label: string;
	/** The column the slice opens - the busiest one in the group. */
	open: Status;
	columns: Status[];
}[] = [
	{
		id: "intake",
		label: "In the queue",
		open: "ranked",
		columns: ["new", "ranked"],
	},
	{
		id: "live",
		label: "Live",
		open: "applied",
		columns: ["applied", "screening", "tech_interview", "final_round", "offer"],
	},
	{ id: "closed", label: "Closed", open: "rejected", columns: ["rejected"] },
	{ id: "passed", label: "Passed over", open: "skipped", columns: ["skipped"] },
];

export type MixSlice = {
	id: string;
	label: string;
	status: Status;
	count: number;
	share: number;
};

/**
 * What came back, one bucket per application and never two - the page prints them as one
 * split bar, so a posting counted twice would draw a bar wider than the applications that
 * went out. The tags do combine (`ghosted` after `failed_tech` is one entry), which is why
 * the order the buckets are tested in is the definition and not an implementation detail.
 *
 * Five buckets rather than "answered" and the rest: a call and a rejection letter are both
 * a human replying, and filing them together produced one figure that could not be read.
 * Each bucket here is a thing that happened, in the words it happened in.
 */
export type Answers = {
	/** Applications that went out, the denominator for the rest. */
	sent: number;
	/** They engaged: a call, an interview, anything past Applied. */
	advanced: number;
	/** Still sitting under Applied with nothing back. */
	open: number;
	/** A stated no, or on hold, and it never reached a call. */
	rejected: number;
	withdrew: number;
	/** Closed and nobody ever replied. */
	silent: number;
};

export type Waiting = {
	job: Job;
	status: Status;
	label: string;
	days: number;
	/** Past this stage's own silence threshold. */
	stale: boolean;
	/**
	 * Days past that threshold, and the sort key. Zero or less is a wait not due yet;
	 * `null` is a stage never chased at all - an offer is theirs to sit on.
	 */
	overdue: number | null;
};

export type Week = {
	/** The Monday it starts on, as `4 May`. */
	label: string;
	count: number;
	/** Height against the busiest week in the window. */
	height: number;
};

export type ScoreBucket = {
	/** The bucket's lower bound, e.g. 60 for 60-69. */
	floor: number;
	count: number;
	/** How many of them became applications, drawn inside the bar. */
	applied: number;
	/** Height against the tallest bucket, so the histogram fills its frame. */
	height: number;
};

/** One of /rank's three verdicts, and what became of the postings that got it. */
export type ScoreBand = {
	id: "high" | "medium" | "low";
	/** `75+`, `60-74`, `<60`. */
	label: string;
	scored: number;
	applied: number;
	/** Still in the intake queue: the ones the verdict is waiting on. */
	queued: number;
};

/** A queued posting with an apply deadline still ahead of it. */
export type Due = {
	job: Job;
	/** Days until it closes; `0` is today. */
	days: number;
	score: number | null;
};

export type Stats = {
	seen: number;
	funnel: FunnelStage[];
	/** Where the population sits now, in pipeline order. Always totals `seen`. */
	mix: MixSlice[];
	/** Applications that went out, on the funnel's own evidence. */
	applied: number;
	/** How many of those carry a date, which is all the weekly strip can plot. */
	sent: number;
	/** The last WEEKS weeks, oldest first, always full length. */
	weeks: Week[];
	/** What came back from the applications that went out. */
	answers: Answers;
	waiting: Waiting[];
	/** Queued postings still open, soonest deadline first. */
	due: Due[];
	/** Queued postings whose deadline has passed - a pile to clear, not a list to read. */
	lapsed: number;
	scored: number;
	/** Scored postings an application actually went out on. */
	scoredApplied: number;
	buckets: ScoreBucket[];
	bands: ScoreBand[];
};

/** Weeks the sent strip plots. A quarter and a bit: long enough to show a stall. */
const WEEKS = 14;
const DAY = 86_400_000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * ISO date as a UTC day number. From the parts rather than `new Date(iso)`, which west
 * of UTC reads a date as the day before.
 */
function utcDay(iso: string | undefined): number | null {
	const m = iso ? ISO.exec(iso) : null;
	return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
}

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

function readableDay(iso: string): string {
	const m = ISO.exec(iso);
	return m ? `${+m[3]} ${MONTHS[+m[2] - 1]}` : iso;
}

/** Which date a live application's wait counts from. Mirrors `stageSince`. */
function waitingSince(job: Job, status: Status): string | undefined {
	switch (status) {
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
			return job.status_date;
	}
}

const share = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

/**
 * A share as a gauge would round it. `<1%` rather than `0%`, because one application
 * out of 347 is not none and the two must not print the same.
 */
export function percent(value: number): string {
	if (value <= 0) return "0%";
	if (value < 0.01) return "<1%";
	return `${Math.round(value * 100)}%`;
}

export function buildStats(jobs: Job[], now = new Date()): Stats {
	const seen = jobs.length;
	const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

	// One pass for the funnel: how far each posting got, tallied cumulatively so a
	// stage counts everything that reached it *or further*.
	const reachedAt = new Array(FUNNEL_STAGES.length).fill(0);
	for (const job of jobs) {
		const reach = reachOf(job);
		for (let i = 0; i <= reach; i++) reachedAt[i] += 1;
	}

	const funnel: FunnelStage[] = [
		{
			status: null,
			label: "Seen",
			reached: seen,
			ofSeen: seen > 0 ? 1 : 0,
			ofPrevious: null,
		},
		...FUNNEL_STAGES.map((status, i) => ({
			status,
			label: COLUMN_LABEL[status] ?? status,
			reached: reachedAt[i],
			ofSeen: share(reachedAt[i], seen),
			ofPrevious: share(reachedAt[i], i === 0 ? seen : reachedAt[i - 1]),
		})),
	];

	const appliedRank = STAGE_RANK.get("applied") ?? 1;

	// Where they sit now. Counted off `columnOf`, the same reading the board's own
	// column totals use, so the dial and the board cannot disagree.
	const byColumn = new Map<Status, number>();
	for (const job of jobs) {
		const column = columnOf(job);
		byColumn.set(column, (byColumn.get(column) ?? 0) + 1);
	}
	const mix: MixSlice[] = MIX.map((group) => {
		const count = group.columns.reduce(
			(sum, column) => sum + (byColumn.get(column) ?? 0),
			0,
		);
		return {
			id: group.id,
			label: group.label,
			status: group.open,
			count,
			share: share(count, seen),
		};
	});

	// What went out, week by week. Off `applied_date` alone: an application's own date
	// is the only thing that can place it in a week, and `status_date` would place a
	// six-week-old application in the week its row was last touched.
	// Off `today` rather than `now`: `today` is the local date read as a UTC day, and
	// the weekday has to come from the same reading or the window slips a day.
	const monday = today - ((new Date(today).getUTCDay() + 6) % 7) * DAY;
	const first = monday - (WEEKS - 1) * 7 * DAY;
	const perWeek = new Array(WEEKS).fill(0);
	let sent = 0;
	for (const job of jobs) {
		const day = utcDay(job.applied_date);
		if (day === null) continue;
		sent += 1;
		const week = Math.floor((day - first) / (7 * DAY));
		if (week >= 0 && week < WEEKS) perWeek[week] += 1;
	}
	const busiest = Math.max(1, ...perWeek);
	const weeks: Week[] = perWeek.map((count: number, i: number) => ({
		label: readableDay(
			new Date(first + i * 7 * DAY).toISOString().slice(0, 10),
		),
		count,
		height: count / busiest,
	}));

	// What came back. One bucket each, in this order, so the five always total `sent`:
	// an application that went quiet after the technical reached the technical first and
	// went quiet second, and the bar has one place to draw it.
	const answers: Answers = {
		sent: 0,
		advanced: 0,
		open: 0,
		rejected: 0,
		withdrew: 0,
		silent: 0,
	};
	const screeningRank = STAGE_RANK.get("screening") ?? 2;
	for (const job of jobs) {
		const reach = reachOf(job);
		if (reach < appliedRank) continue;
		answers.sent += 1;
		const column = columnOf(job);
		const tags = new Set(outcomeTags(job).map((tag) => tag.id));
		// No tag on a closed application is the real answer "they said no" - the reading
		// `declined` and `auto_rejected` also spell out on purpose, so either counts here
		// the same as no tag at all.
		const stated =
			column === "rejected" &&
			(tags.size === 0 || tags.has("declined") || tags.has("auto_rejected"));
		if (reach >= screeningRank) answers.advanced += 1;
		else if (column === "applied") answers.open += 1;
		else if (tags.has("withdrawn")) answers.withdrew += 1;
		else if (stated || tags.has("on_hold")) answers.rejected += 1;
		else answers.silent += 1;
	}

	// What is still open, most overdue first - the one section that names a next action
	// rather than reporting a total, so the order it comes back in is the recommendation.
	// Ordered by how far past its own threshold each wait is rather than by raw age: a
	// fortnight after an interview is a call to make, seven weeks after applying is not.
	const waiting: Waiting[] = [];
	for (const job of jobs) {
		const status = columnOf(job);
		if (!STAGE_RANK.has(status) || status === "ranked") continue;
		const since = utcDay(waitingSince(job, status));
		const days =
			since === null ? 0 : Math.max(0, Math.round((today - since) / DAY));
		const overdue = overdueBy(days, status);
		waiting.push({
			job,
			status,
			label: COLUMN_LABEL[status] ?? status,
			days,
			stale: (overdue ?? 0) > 0,
			overdue,
		});
	}
	// A stage that is never chased sorts to the bottom whatever its age, which is the
	// whole point of it: an offer sitting for two months is not a debt anybody owes.
	const debt = (row: Waiting) => row.overdue ?? Number.NEGATIVE_INFINITY;
	waiting.sort((a, b) => debt(b) - debt(a) || b.days - a.days);

	// What is about to close. Queued postings only: once an application is out, when
	// applications closed cannot change anything - the same rule the cards follow.
	const due: Due[] = [];
	let lapsed = 0;
	for (const job of jobs) {
		if (!QUEUED.has(columnOf(job)) || !job.rank_deadline) continue;
		const days = dueInDays(job.rank_deadline, now);
		if (days === null) continue;
		if (days < 0) lapsed += 1;
		else due.push({ job, days, score: job.rank_score ?? null });
	}
	due.sort((a, b) => a.days - b.days);

	// What /rank concluded, and whether its queue is where applications came from.
	const scoredJobs = jobs.filter((job) => job.rank_score != null);
	const counts = new Map<number, { count: number; applied: number }>();
	const bands = new Map<ScoreBand["id"], ScoreBand>([
		["high", { id: "high", label: "75+", scored: 0, applied: 0, queued: 0 }],
		[
			"medium",
			{ id: "medium", label: "60-74", scored: 0, applied: 0, queued: 0 },
		],
		["low", { id: "low", label: "<60", scored: 0, applied: 0, queued: 0 }],
	]);
	for (const job of scoredJobs) {
		const score = job.rank_score ?? 0;
		const out = reachOf(job) >= appliedRank;
		const floor = Math.min(90, Math.floor(score / 10) * 10);
		const bucket = counts.get(floor) ?? { count: 0, applied: 0 };
		bucket.count += 1;
		if (out) bucket.applied += 1;
		counts.set(floor, bucket);

		const band = bands.get(scoreLamp(score));
		if (!band) continue;
		band.scored += 1;
		if (out) band.applied += 1;
		if (QUEUED.has(columnOf(job))) band.queued += 1;
	}
	const tallest = Math.max(1, ...[...counts.values()].map((b) => b.count));
	const buckets: ScoreBucket[] = [...counts.keys()]
		.sort((a, b) => a - b)
		.map((floor) => {
			const bucket = counts.get(floor) ?? { count: 0, applied: 0 };
			return {
				floor,
				count: bucket.count,
				applied: bucket.applied,
				height: bucket.count / tallest,
			};
		});

	return {
		seen,
		funnel,
		mix,
		applied: reachedAt[appliedRank] ?? 0,
		sent,
		weeks,
		answers,
		waiting,
		due,
		lapsed,
		scored: scoredJobs.length,
		scoredApplied: scoredJobs.filter((job) => reachOf(job) >= appliedRank)
			.length,
		buckets,
		bands: [...bands.values()],
	};
}
