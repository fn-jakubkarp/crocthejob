import { expect, test } from "bun:test";
import { buildHistory } from "./history";
import type { Job } from "./types";

/**
 * The rule worth guarding is the batching: a scrape run is one line whatever it wrote,
 * and a posting moving is a line whatever else happened that day. Run with `bun test`.
 */

const job = (over: Partial<Job>): Job => ({ key: over.key ?? "k", ...over });
const now = new Date("2026-08-10T12:00:00Z");

test("a scrape run is one line a day, whatever it swept", () => {
	const days = buildHistory(
		[
			job({ key: "a", first_seen: "2026-07-29", portal: "justjoinit-search" }),
			job({ key: "b", first_seen: "2026-07-29", portal: "justjoinit-search" }),
			job({ key: "c", first_seen: "2026-07-29", portal: "linkedin-search" }),
			job({ key: "d", first_seen: "2026-08-04", portal: "justjoinit-search" }),
		],
		now,
	);
	expect(days.map((d) => d.date)).toEqual(["2026-08-04", "2026-07-29"]);
	const older = days[1].events;
	expect(older).toHaveLength(1);
	expect(older[0].lead).toBe("3 postings");
	// Which portals it hit is detail on the one line, busiest first.
	expect(older[0].detail).toBe("justjoin.it 2 · LinkedIn 1");
	expect(days[1].count).toBe(3);
});

test("a hand-added entry is its own line, not a portal's", () => {
	const days = buildHistory(
		[job({ key: "a", first_seen: "2026-08-09", portal: "manual (user)" })],
		now,
	);
	expect(days[0].events[0].kind).toBe("added");
	expect(days[0].events[0].detail).toBe("Added by hand");
	expect(days[0].label).toBe("Yesterday");
	expect(days[0].age).toBe("1d");
});

test("every stage date a posting carries is its own line, on its own day", () => {
	const days = buildHistory(
		[
			job({
				key: "a",
				company: "Acme",
				title: "QA Engineer",
				status: "tech_interview",
				applied_date: "2026-07-03",
				screening_date: "2026-07-01",
				tech_interview_date: "2026-07-15",
				// The day the card was last moved, which on a live application dates
				// nothing that happened.
				status_date: "2026-08-06",
			}),
		],
		now,
	);
	expect(days.map((d) => [d.date, d.events[0].kind])).toEqual([
		["2026-07-15", "tech_interview"],
		["2026-07-03", "applied"],
		["2026-07-01", "screening"],
	]);
	expect(days[0].events[0].status).toBe("tech_interview");
});

test("a closed application is dated, and says how it ended", () => {
	const days = buildHistory(
		[
			job({
				key: "a",
				company: "Globex",
				status: "rejected",
				outcome: ["ghosted"],
				status_date: "2026-08-05",
				applied_date: "2026-06-16",
			}),
		],
		now,
	);
	expect(days[0].events[0].kind).toBe("closed");
	expect(days[0].events[0].detail).toBe("Ghosted");
	expect(days[0].events[0].mark).toBe("ghost");
	expect(days[1].events[0].kind).toBe("applied");
});

test("a ranking pass is one line, reading its top and its keepers", () => {
	const days = buildHistory(
		[
			job({ key: "a", rank_date: "2026-07-30", rank_score: 82 }),
			job({ key: "b", rank_date: "2026-07-30", rank_score: 34 }),
			// Ranked that day, never scored: still one of the postings the pass read.
			job({ key: "c", rank_date: "2026-07-30" }),
		],
		now,
	);
	const ranked = days[0].events.find((e) => e.kind === "ranked");
	expect(ranked?.count).toBe(3);
	expect(ranked?.detail).toBe("Top score 82 · 1 worth applying to");
});

test("a pass that turned nothing up says only what it topped out at", () => {
	const days = buildHistory(
		[job({ key: "a", rank_date: "2026-07-30", rank_score: 58 })],
		now,
	);
	expect(days[0].events[0].detail).toBe("Top score 58");
});

test("the pipeline orders a day, and an empty file makes no days", () => {
	const days = buildHistory(
		[
			job({ key: "a", first_seen: "2026-08-10", portal: "linkedin-search" }),
			job({ key: "b", company: "N-iX", applied_date: "2026-08-10" }),
		],
		now,
	);
	expect(days[0].label).toBe("Today");
	expect(days[0].events.map((e) => e.kind)).toEqual(["applied", "found"]);
	expect(buildHistory([], now)).toEqual([]);
});
