import { describe, expect, test } from "bun:test";
import { daysElapsed, processSince } from "./dates";
import { buildJourney, buildStages, buildTimeline } from "./timeline";
import type { Job } from "./types";

const NOW = new Date("2026-03-20T12:00:00");

const job = (fields: Partial<Job>): Job => ({ key: "k", ...fields });

describe("buildTimeline", () => {
	test("gaps count from the point before, and the first has none", () => {
		const { legs } = buildTimeline(
			job({
				first_seen: "2026-03-01",
				rank_date: "2026-03-02",
				applied_date: "2026-03-10",
				status: "applied",
			}),
			NOW,
		);
		expect(legs.map((l) => [l.label, l.gap])).toEqual([
			["Seen", null],
			["Ranked", 1],
			["Applied", 8],
		]);
	});

	test("a stage with no date is left out, never interpolated", () => {
		const { legs } = buildTimeline(
			job({
				applied_date: "2026-03-01",
				tech_interview_date: "2026-03-15",
				status: "tech_interview",
			}),
			NOW,
		);
		// No screening happened, so no screening leg and one 14-day jump.
		expect(legs.map((l) => l.label)).toEqual(["Applied", "Tech interview"]);
		expect(legs[1].gap).toBe(14);
	});

	test("legs run by date even when the stage dates were entered out of order", () => {
		const { legs } = buildTimeline(
			job({
				applied_date: "2026-03-10",
				screening_date: "2026-03-05",
				status: "screening",
			}),
			NOW,
		);
		expect(legs.map((l) => l.label)).toEqual(["Screening", "Applied"]);
		expect(legs[1].gap).toBe(5);
	});

	test("total runs to the close once there is one, and to today while open", () => {
		const open = buildTimeline(
			job({ applied_date: "2026-03-10", status: "applied" }),
			NOW,
		);
		expect(open.total).toBe(10);

		const closed = buildTimeline(
			job({
				applied_date: "2026-03-01",
				rejected_date: "2026-03-08",
				status: "rejected",
			}),
			NOW,
		);
		expect(closed.total).toBe(7);
	});

	test("nothing to measure before an application goes out", () => {
		const { total, waiting } = buildTimeline(
			job({ first_seen: "2026-03-01", status: "new" }),
			NOW,
		);
		expect(total).toBeNull();
		expect(waiting).toBeNull();
	});

	test("a rejection dated before the application is a typo, not a negative total", () => {
		const { total } = buildTimeline(
			job({
				applied_date: "2026-03-10",
				rejected_date: "2026-03-01",
				status: "rejected",
			}),
			NOW,
		);
		expect(total).toBeNull();
	});

	test("the wait lights up once it is past the stage's chase threshold", () => {
		// Applied is chased at 21 days.
		const fresh = buildTimeline(
			job({ applied_date: "2026-03-18", status: "applied" }),
			NOW,
		);
		expect(fresh.waiting).toEqual({ days: 2, stale: false });

		const quiet = buildTimeline(
			job({ applied_date: "2026-02-01", status: "applied" }),
			NOW,
		);
		expect(quiet.waiting?.stale).toBe(true);
	});
});

/**
 * The rail reads the same dates the other way round: every stage present, so the gap in
 * the middle is visible rather than closed over. And a date ahead of today is a booking,
 * which every reading in `dates.ts` refuses to call an age.
 */
describe("buildStages", () => {
	/** A live application with a stage booked for tomorrow and no ranking pass. */
	const live = job({
		status: "final_round",
		first_seen: "2026-03-01",
		applied_date: "2026-03-03",
		screening_date: "2026-03-08",
		tech_interview_date: "2026-03-15",
		final_round_date: "2026-03-21",
	});

	test("every stage keeps its slot, and the days run between the dated ones", () => {
		const stages = buildStages(live, NOW);
		expect(stages.map((s) => s.status)).toEqual([
			"new",
			"ranked",
			"applied",
			"screening",
			"tech_interview",
			"final_round",
			"offer",
		]);
		// Ranked has no date, so the run measures across it rather than breaking.
		expect(stages[1].date).toBeUndefined();
		expect(stages[1].days).toBeNull();
		expect(stages[2].days).toBe(2);
		expect(stages[2].from).toBe("New");
		expect(stages[4].days).toBe(7);
		expect(stages.find((s) => s.current)?.status).toBe("final_round");
		expect(stages.filter((s) => s.reached)).toHaveLength(6);
	});

	test("a stage dated ahead of today is a booking, not a wait", () => {
		const stages = buildStages(live, NOW);
		expect(stages[5].ahead).toBe(1);
		expect(stages[4].ahead).toBeNull();
	});

	test("a closed entry stops at the last stage it has a date for", () => {
		const stages = buildStages(
			job({
				status: "rejected",
				first_seen: "2026-02-01",
				applied_date: "2026-02-02",
				screening_date: "2026-02-09",
				rejected_date: "2026-03-01",
			}),
			NOW,
		);
		expect(stages.find((s) => s.current)?.status).toBe("screening");
	});

	test("an entry with nothing but a first sighting still reads as a rail", () => {
		const stages = buildStages(job({ first_seen: "2026-03-18" }), NOW);
		expect(stages[0].current).toBe(true);
		expect(stages.filter((s) => s.reached)).toHaveLength(1);
	});
});

describe("buildJourney", () => {
	test("the hand-written log mixes into the dates and splits around today", () => {
		const { upcoming, past } = buildJourney(
			job({
				status: "tech_interview",
				first_seen: "2026-03-01",
				applied_date: "2026-03-03",
				tech_interview_date: "2026-03-25",
				portal: "justjoinit-search",
				notes: "2 Mar: Recruiter mailed\n18 Mar: Positive feedback",
			}),
			NOW,
		);
		// The technical is booked five days out, so it is not in the run yet.
		expect(upcoming.map((e) => e.id)).toEqual(["tech_interview_date"]);
		expect(upcoming[0].ahead).toBe(5);
		expect(past.map((e) => e.id)).toEqual([
			"note:1",
			"applied_date",
			"note:0",
			"first_seen",
		]);
		// 18 Mar back to the application on 3 Mar.
		expect(past[0].gap).toBe(15);
		// The oldest line has nothing to measure from, which is not a same-day zero.
		expect(past.at(-1)?.gap).toBeNull();
		// The sighting says where it came from; a hand-added entry says so instead.
		expect(past.at(-1)?.text).toBe("justjoin.it");
		expect(past.at(-1)?.kind).toBe("found");
	});

	test("two events on one day read note first, then the pipeline order", () => {
		const { past } = buildJourney(
			job({
				status: "applied",
				first_seen: "2026-03-10",
				applied_date: "2026-03-10",
				portal: "manual (user)",
				notes: "10 Mar: Recruiter DM\n10 Mar: Sent the CV",
			}),
			NOW,
		);
		expect(past.map((e) => e.id)).toEqual([
			"note:1",
			"note:0",
			"applied_date",
			"first_seen",
		]);
		expect(past.at(-1)?.kind).toBe("added");
	});

	test("an ending carries how it ended", () => {
		const { past } = buildJourney(
			job({
				status: "rejected",
				first_seen: "2026-02-01",
				rejected_date: "2026-03-01",
				outcome: ["ghosted", "failed_tech"],
			}),
			NOW,
		);
		expect(past[0].kind).toBe("closed");
		expect(past[0].text).toBe("Ghosted · Failed tech");
	});
});

test("how long it has been in play comes off the earliest date it carries", () => {
	// Logged after the fact, so `applied_date` alone would have said the process started
	// nine days after it did.
	const entry = job({ first_seen: "2026-03-01", applied_date: "2026-03-10" });
	expect(processSince(entry)).toBe("2026-03-01");
	expect(daysElapsed(processSince(entry) as string, NOW)).toBe(19);
	expect(processSince(job({}))).toBeUndefined();
});
