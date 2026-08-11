import { expect, test } from "bun:test";
import { inverse } from "./status";
import type { Job } from "./types";

/**
 * What breaks silently here is the undo of a move *down* the pipeline: the write that
 * cleared the stage dates has to name them on the way back, or `apply` clears them
 * again the moment the status goes below them. Run with `bun test`.
 */

const job = (over: Partial<Job>): Job => ({ key: "k", ...over });

test("a move down the pipeline comes back with the dates and tags it cleared", () => {
	const rejected = job({
		status: "rejected",
		applied_date: "2026-07-01",
		screening_date: "2026-07-14",
		rejected_date: "2026-08-01",
		outcome: ["ghosted"],
	});
	expect(inverse(rejected, { status: "applied" })).toEqual({
		status: "rejected",
		screening_date: "2026-07-14",
		rejected_date: "2026-08-01",
		outcome: ["ghosted"],
	});
});

test("a move up the pipeline comes back as the status alone", () => {
	expect(inverse(job({ status: "new" }), { status: "ranked" })).toEqual({
		status: "new",
	});
});

test("an entry with no status of its own goes back to New", () => {
	expect(inverse(job({}), { status: "applied" })).toEqual({ status: "new" });
});

test("each shape empties its own way", () => {
	const held = job({ status: "rejected", outcome: ["ghosted"], notes: "hm" });
	expect(inverse(held, { outcome: [], notes: "" })).toEqual({
		outcome: ["ghosted"],
		notes: "hm",
	});
	expect(inverse(job({}), { duplicate_of: "other", notes: "x" })).toEqual({
		duplicate_of: null,
		notes: "",
	});
});
