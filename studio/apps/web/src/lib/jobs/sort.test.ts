import { expect, test } from "bun:test";
import { effectiveSort, isSortId, sorter } from "./sort";
import type { Job } from "./types";

/**
 * The fallback chain is what can break silently here: without it every entry written
 * before the board stamped `last_updated` ties at one value and the column comes back
 * in file order, which still looks like a sort. Run with `bun test`.
 */

const job = (over: Partial<Job>): Job => ({ key: over.key ?? "k", ...over });

const order = (jobs: Job[]) =>
	[...jobs].sort(sorter("updated_desc")).map((j) => j.key);

test("a stamped entry sorts above one that only moved stage earlier", () => {
	expect(
		order([
			job({ key: "stale", status_date: "2026-01-01" }),
			job({ key: "touched", last_updated: "2026-08-10" }),
		]),
	).toEqual(["touched", "stale"]);
});

test("last_updated wins over the entry's own status_date", () => {
	// The pair that motivated the field: dragged in January, annotated in August.
	expect(
		order([
			job({ key: "dragged_later", status_date: "2026-02-01" }),
			job({
				key: "noted_today",
				status_date: "2026-01-01",
				last_updated: "2026-08-10",
			}),
		]),
	).toEqual(["noted_today", "dragged_later"]);
});

test("an entry with neither stamp falls back to first_seen", () => {
	expect(
		order([
			job({ key: "old", first_seen: "2026-01-01" }),
			job({ key: "newer", first_seen: "2026-06-01" }),
			job({ key: "nothing" }),
		]),
	).toEqual(["newer", "old", "nothing"]);
});

test("only intake leads with the score", () => {
	expect(effectiveSort("intake")).toBe("score");
	expect(effectiveSort("live")).toBe("updated_desc");
	expect(effectiveSort("archive")).toBe("updated_desc");
	// A score sort carried into archive still has nothing to read there.
	expect(effectiveSort("archive", "score")).toBe("updated_desc");
	// What the user picked otherwise stands.
	expect(effectiveSort("live", "company")).toBe("company");
});

test("the renamed sort id no longer passes as one this build offers", () => {
	expect(isSortId("updated_desc")).toBe(true);
	// What a browser still holds in localStorage from before the rename.
	expect(isSortId("status_date_desc")).toBe(false);
	expect(isSortId(undefined)).toBe(false);
});
