import { expect, test } from "bun:test";
import { buildStats, percent } from "./stats";
import type { Job } from "./types";

/**
 * The one thing here that can break silently is `reachOf`: it reconstructs how far a
 * posting got from three kinds of evidence, and a wrong answer produces a funnel that
 * still looks plausible. Run with `bun test`.
 */

const job = (over: Partial<Job>): Job => ({ key: over.key ?? "k", ...over });

test("a terminal status proves every stage under it", () => {
	const stats = buildStats([
		job({ key: "a", status: "new" }),
		job({ key: "b", status: "ranked" }),
		job({ key: "c", status: "applied" }),
		job({ key: "d", status: "screening" }),
		job({ key: "e", status: "tech_interview" }),
		job({ key: "f", status: "offer" }),
	]);
	// Seen, ranked, applied, screening, tech, final_round, offer.
	expect(stats.funnel.map((s) => s.reached)).toEqual([6, 5, 4, 3, 2, 1, 1]);
});

test("rejected proves an application went out and nothing further", () => {
	const stats = buildStats([job({ key: "a", status: "rejected" })]);
	expect(stats.funnel.map((s) => s.reached)).toEqual([1, 1, 1, 0, 0, 0, 0]);
	// No tag on a closed application is the real answer "they said no".
	expect(stats.answers).toMatchObject({ sent: 1, rejected: 1 });
});

test("an outcome tag carries a dead application back up the funnel", () => {
	const stats = buildStats([
		job({ key: "a", status: "rejected", outcome: ["ghosted", "failed_tech"] }),
	]);
	expect(stats.funnel.map((s) => s.reached)).toEqual([1, 1, 1, 1, 1, 0, 0]);
});

test("skipped is a posting passed over, never an application", () => {
	const stats = buildStats([
		job({ key: "a", status: "skipped", rank_score: 80 }),
		// Written by /rank and older board builds; both fold into skipped.
		job({ key: "b", status: "expired" }),
		job({ key: "c", status: "dismissed" }),
	]);
	expect(stats.funnel.map((s) => s.reached)).toEqual([3, 3, 0, 0, 0, 0, 0]);
});

test("a legacy ghosted status still reads as a closed application", () => {
	const stats = buildStats([job({ key: "a", status: "ghosted" })]);
	expect(stats.funnel[2].reached).toBe(1);
	expect(stats.answers.silent).toBe(1);
});

test("a hand-set date proves a stage a status has moved on from", () => {
	const stats = buildStats([
		job({ key: "a", status: "rejected", screening_date: "2026-06-01" }),
	]);
	expect(stats.funnel.map((s) => s.reached)).toEqual([1, 1, 1, 1, 0, 0, 0]);
});

test("the mix accounts for every posting exactly once", () => {
	const stats = buildStats([
		job({ key: "a", status: "new" }),
		job({ key: "b", status: "ranked" }),
		job({ key: "c", status: "screening" }),
		job({ key: "d", status: "rejected" }),
		// Legacy and folded statuses land in a group like everything else.
		job({ key: "e", status: "expired" }),
		job({ key: "f", status: "ghosted" }),
		job({ key: "g", status: undefined }),
	]);
	const counts = Object.fromEntries(stats.mix.map((s) => [s.id, s.count]));
	expect(counts).toEqual({ intake: 3, live: 1, closed: 2, passed: 1 });
	expect(stats.mix.reduce((sum, s) => sum + s.count, 0)).toBe(stats.seen);
});

test("an empty file divides by nothing", () => {
	const stats = buildStats([]);
	expect(stats.seen).toBe(0);
	expect(stats.funnel.every((s) => s.reached === 0)).toBe(true);
	expect(stats.buckets).toEqual([]);
	expect(stats.due).toEqual([]);
	expect(stats.lapsed).toBe(0);
	expect(stats.answers.sent).toBe(0);
	// Three bands whatever the file holds: a band nobody scored is a finding.
	expect(stats.bands.map((b) => b.scored)).toEqual([0, 0, 0]);
});

/**
 * `answers` is a split bar, so every application has to land in exactly one bucket. Tags
 * combine - one entry went quiet *after* the technical - and the order they are tested in
 * is what decides which bucket wins.
 */
test("every application that went out lands in exactly one bucket", () => {
	const { answers } = buildStats([
		job({ key: "waiting", status: "applied" }),
		job({ key: "said_no", status: "rejected" }),
		job({ key: "ghosted", status: "rejected", outcome: ["ghosted"] }),
		job({ key: "withdrew", status: "rejected", outcome: ["withdrawn"] }),
		job({ key: "live", status: "screening" }),
		job({ key: "hold", status: "rejected", outcome: ["on_hold"] }),
		// Not an application at all, so it is not in the denominator.
		job({ key: "queued", status: "ranked" }),
	]);
	expect(answers).toEqual({
		sent: 6,
		advanced: 1,
		open: 1,
		rejected: 2,
		withdrew: 1,
		silent: 1,
	});
	const { advanced, open, rejected, withdrew, silent } = answers;
	expect(advanced + open + rejected + withdrew + silent).toBe(answers.sent);
});

test("silence after a stage is a stage reached, not silence", () => {
	const { answers } = buildStats([
		job({ key: "a", status: "rejected", outcome: ["ghosted", "failed_tech"] }),
	]);
	expect(answers).toMatchObject({ sent: 1, advanced: 1, silent: 0 });
});

/**
 * The threshold is per stage, so the same fifteen days of silence is a call to make
 * after a recruiter screening and nothing at all after an application went out.
 */
test("a live stage goes quiet sooner than a cold application", () => {
	const { waiting } = buildStats(
		[
			job({ key: "applied", status: "applied", applied_date: "2026-07-27" }),
			job({
				key: "screening",
				status: "screening",
				screening_date: "2026-07-27",
			}),
		],
		new Date("2026-08-11T09:00:00Z"),
	);
	expect(waiting.map((w) => [w.job.key, w.days, w.stale])).toEqual([
		["screening", 15, true],
		["applied", 15, false],
	]);
});

test("waits come back most overdue first, not oldest first", () => {
	const { waiting } = buildStats(
		[
			// Oldest by a mile, and never chased: an offer is theirs to wait on.
			job({ key: "offer", status: "offer", offer_date: "2026-06-12" }),
			job({ key: "applied", status: "applied", applied_date: "2026-07-12" }),
			job({
				key: "screening",
				status: "screening",
				screening_date: "2026-07-22",
			}),
		],
		new Date("2026-08-11T09:00:00Z"),
	);
	expect(waiting.map((w) => [w.job.key, w.overdue])).toEqual([
		["applied", 9],
		["screening", 6],
		["offer", null],
	]);
});

test("a lapsed deadline is a figure to clear, not a row to read", () => {
	const stats = buildStats(
		[
			job({ key: "soon", status: "ranked", rank_deadline: "2026-08-14" }),
			job({ key: "today", status: "ranked", rank_deadline: "2026-08-11" }),
			job({ key: "gone", status: "ranked", rank_deadline: "2026-07-01" }),
			// Out already: when applications closed cannot change anything now.
			job({ key: "applied", status: "applied", rank_deadline: "2026-08-12" }),
			job({ key: "skipped", status: "skipped", rank_deadline: "2026-08-12" }),
		],
		new Date("2026-08-11T09:00:00Z"),
	);
	expect(stats.due.map((d) => [d.job.key, d.days])).toEqual([
		["today", 0],
		["soon", 3],
	]);
	expect(stats.lapsed).toBe(1);
});

test("a band counts what became of the postings that got its verdict", () => {
	const stats = buildStats([
		job({ key: "a", status: "ranked", rank_score: 80 }),
		job({ key: "b", status: "applied", rank_score: 76 }),
		job({ key: "c", status: "skipped", rank_score: 62 }),
		job({ key: "d", status: "new", rank_score: 41 }),
	]);
	expect(stats.bands).toEqual([
		{ id: "high", label: "75+", scored: 2, applied: 1, queued: 1 },
		{ id: "medium", label: "60-74", scored: 1, applied: 0, queued: 0 },
		{ id: "low", label: "<60", scored: 1, applied: 0, queued: 1 },
	]);
	// The bar for the 80s shows the one that stayed in the queue against the one that did not.
	expect(stats.buckets.find((b) => b.floor === 80)).toMatchObject({
		count: 1,
		applied: 0,
	});
});

test("a share too small to round still reads as present", () => {
	expect(percent(0)).toBe("0%");
	expect(percent(1 / 347)).toBe("<1%");
	expect(percent(0.196)).toBe("20%");
});
