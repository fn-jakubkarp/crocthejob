import { expect, test } from "bun:test";
import { apply, remove } from "./apply.ts";
import { isManual, type JobEntry } from "./schema.ts";
import { today } from "./values.ts";

/**
 * `last_updated` is the one thing here that can break silently: a missing stamp still
 * writes the change, so the entry just quietly claims to be older than it is. Run with
 * `bun test`.
 */

const seen = (entry: JobEntry) => ({ k: entry });

test("a change nothing else records still stamps last_updated", () => {
	const file = seen({ title: "QA Engineer", company: "Acme" });
	const moved = apply(file, "k", { notes: "called back" });

	expect(moved).toEqual(["notes"]);
	expect(file.k.last_updated).toBe(today());
	// The stamp is not one of the changes: it must not reach the write log.
	expect(moved.join()).not.toContain("last_updated");
	// A note is not a stage move, so the status stamp stays where it was.
	expect(file.k.status_date).toBeUndefined();
});

test("a write that changes nothing leaves the stamp alone", () => {
	const file = seen({
		title: "QA Engineer",
		company: "Acme",
		notes: "called back",
		last_updated: "2026-01-01",
	});
	const moved = apply(file, "k", { notes: "called back" });

	expect(moved).toEqual([]);
	expect(file.k.last_updated).toBe("2026-01-01");
});

/**
 * A mis-drag, and the drag back that has to undo it. The file records stages by writing
 * dates and the history page reads those dates back, so a stage date left behind by a
 * reverted move is an event that never happened, printed for good.
 */

const live = (): JobEntry => ({
	title: "QA Engineer",
	company: "Acme",
	status: "screening",
	applied_date: "2026-07-14",
	screening_date: "2026-08-02",
});

test("moving forward clears nothing", () => {
	const file = seen({ ...live(), status: "applied" });
	apply(file, "k", { status: "screening" });

	expect(file.k.applied_date).toBe("2026-07-14");
	expect(file.k.screening_date).toBe("2026-08-02");
});

test("moving back down the pipeline drops the stage above it", () => {
	const file = seen(live());
	const moved = apply(file, "k", { status: "applied" });

	expect(file.k.screening_date).toBeUndefined();
	expect(file.k.applied_date).toBe("2026-07-14");
	expect(moved).toContain("screening_date cleared");
});

test("moving back to intake drops every application date", () => {
	const file = seen(live());
	apply(file, "k", { status: "ranked" });

	expect(file.k.applied_date).toBeUndefined();
	expect(file.k.screening_date).toBeUndefined();
});

test("leaving Rejected drops the rejection and its tags", () => {
	const file = seen({
		...live(),
		status: "rejected",
		rejected_date: "2026-08-09",
		outcome: ["ghosted"],
	});
	const moved = apply(file, "k", { status: "screening" });

	expect(file.k.rejected_date).toBeUndefined();
	expect(file.k.outcome).toBeUndefined();
	expect(file.k.screening_date).toBe("2026-08-02");
	expect(moved).toContain("outcome cleared");
});

test("Skipped is not on the pipeline, so it clears nothing", () => {
	const file = seen(live());
	apply(file, "k", { status: "skipped" });

	expect(file.k.applied_date).toBe("2026-07-14");
	expect(file.k.screening_date).toBe("2026-08-02");
});

test("a date set by the same write outranks the move", () => {
	const file = seen(live());
	apply(file, "k", { status: "applied", screening_date: "2026-08-03" });

	expect(file.k.screening_date).toBe("2026-08-03");
});

test("an outcome set by the same write survives the move", () => {
	const file = seen({ ...live(), outcome: ["ghosted"] });
	apply(file, "k", { status: "applied", outcome: ["on_hold"] });

	expect(file.k.outcome).toEqual(["on_hold"]);
});

/** Deleting a hand-added entry. The copies it held must not be orphaned. */

test("delete frees the copies filed under the entry", () => {
	const file = {
		k: { company: "Acme", portal: "manual (user)" } as JobEntry,
		copy: { company: "Acme", duplicate_of: "k" } as JobEntry,
		other: { company: "Globex", duplicate_of: "elsewhere" } as JobEntry,
	};
	const freed = remove(file, "k");

	expect(file.k).toBeUndefined();
	expect(freed).toEqual(["copy"]);
	// Null, not absent: absent reads as "not yet judged" and the suggestion returns.
	expect(file.copy.duplicate_of).toBeNull();
	expect(file.other.duplicate_of).toBe("elsewhere");
});

test("only a hand-added entry reads as deletable", () => {
	expect(isManual({ portal: "manual (user)" })).toBe(true);
	expect(isManual({ portal: "justjoinit-search" })).toBe(false);
	expect(isManual({})).toBe(false);
});
