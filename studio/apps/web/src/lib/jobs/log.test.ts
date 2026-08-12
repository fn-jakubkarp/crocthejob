import { expect, test } from "bun:test";
import {
	appendEntry,
	dropEntry,
	parseLog,
	redateEntry,
	rewriteEntry,
} from "./log";

/**
 * Two rules are worth guarding. The year nobody wrote down has to come out right, and
 * a write has to leave every other byte of the note alone - that is what keeps the
 * field the source of truth and the diff one line. Run with `bun test`.
 */

const now = new Date("2026-08-12T12:00:00Z");

const SINGU = [
	"30 Jun: Contacted by Amelia Zawadzka (HR Hints, external agency)",
	"3 Jul: Screening",
	"8 Jul: Positive feedback, tech invitation",
	"11 Aug: Jakub called me, invited me to final round",
	"13 Aug: Scheduled final round",
].join("\n");

test("the year is inferred down the log, including one written before the scrape", () => {
	// `30 Jun` predates first_seen by a day: a recruiter's message can arrive before
	// the posting is found, so the floor has to be soft enough to keep it in 2026.
	const log = parseLog(SINGU, { since: "2026-07-01", now });
	expect(log.entries.map((e) => e.date)).toEqual([
		"2026-06-30",
		"2026-07-03",
		"2026-07-08",
		"2026-08-11",
		"2026-08-13",
	]);
	expect(log.entries.every((e) => e.inferred)).toBe(true);
	expect(log.style).toBe("short");
});

test("a December entry followed by a January one rolls into the next year", () => {
	const log = parseLog("20 Dec: Sent\n5 Jan: Call booked", {
		since: "2026-12-01",
		now: new Date("2026-12-22T12:00:00Z"),
	});
	expect(log.entries.map((e) => e.date)).toEqual(["2026-12-20", "2027-01-05"]);
});

test("an out-of-order log does not fly a year forward", () => {
	const log = parseLog("3 Jul: Screening\n30 Jun: First contact", {
		since: "2026-07-01",
		now,
	});
	expect(log.entries.map((e) => e.date)).toEqual(["2026-07-03", "2026-06-30"]);
});

test("a written year wins, and the last entry sets the note's style", () => {
	const log = parseLog("8 Jul 2025: Older thing\n2026-07-03: Screening", {
		since: "2026-07-01",
		now,
	});
	expect(log.entries.map((e) => e.date)).toEqual(["2025-07-08", "2026-07-03"]);
	expect(log.entries.map((e) => e.inferred)).toEqual([false, false]);
	expect(log.style).toBe("iso");
});

test("prose is not a log entry, whatever colon it carries", () => {
	const log = parseLog(
		["Recruiter: Amelia, 14-16k B2B", "3 Jul: Screening", "Rate: 90/h"].join(
			"\n",
		),
		{ since: "2026-07-01", now },
	);
	expect(log.entries).toHaveLength(1);
	expect(log.entries[0].text).toBe("Screening");
	expect(log.prose).toBe("Recruiter: Amelia, 14-16k B2B\nRate: 90/h");
});

test("a list marker is kept, and a rewrite touches one line", () => {
	const notes = "- 3 Jul: Screening\n- 8 Jul: Feedback";
	const log = parseLog(notes, { since: "2026-07-01", now });
	expect(log.entries[0].line).toBe(0);
	expect(rewriteEntry(notes, 1, "Positive feedback")).toBe(
		"- 3 Jul: Screening\n- 8 Jul: Positive feedback",
	);
});

test("a redate keeps the words and the marker", () => {
	expect(redateEntry("- 3 Jul: Screening", 0, "2026-07-04")).toBe(
		"- 4 Jul: Screening",
	);
	expect(redateEntry("2026-07-03: Screening", 0, "2026-07-04", "iso")).toBe(
		"2026-07-04: Screening",
	);
});

test("an appended entry matches the note's own style", () => {
	expect(appendEntry("3 Jul: Screening", "2026-08-13", "Final round")).toBe(
		"3 Jul: Screening\n13 Aug: Final round",
	);
	expect(appendEntry("", "2026-08-13", "Final round", "iso")).toBe(
		"2026-08-13: Final round",
	);
	expect(appendEntry(undefined, "2026-08-13", "Applied")).toBe(
		"13 Aug: Applied",
	);
});

test("a dropped entry takes its line with it", () => {
	expect(dropEntry("3 Jul: Screening\n8 Jul: Feedback", 0)).toBe(
		"8 Jul: Feedback",
	);
});
