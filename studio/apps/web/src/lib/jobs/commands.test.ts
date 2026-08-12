import { describe, expect, it } from "bun:test";
import { commandsFor, stageOf } from "./commands";
import { STATUSES } from "./status";
import type { Job } from "./types";

const job = (over: Partial<Job> = {}): Job =>
	({ key: "k", id: 1, status: "new", ...over }) as Job;

const ids = (j: Job) => commandsFor(j).map((c) => c.def.id);

describe("commandsFor", () => {
	it("offers something at every status while the entry is unscored", () => {
		for (const status of STATUSES) {
			expect(ids(job({ status, url: "https://x" })).length).toBeGreaterThan(0);
		}
	});

	it("offers nothing on a closed entry that has already been scored", () => {
		expect(
			ids(job({ status: "rejected", url: "https://x", rank_score: 71 })),
		).toBeEmpty();
	});

	it("blocks the commands that read a posting when there is neither file nor URL", () => {
		const blocked = commandsFor(job({ status: "new" })).filter(
			(c) => c.blocked,
		);
		expect(blocked.map((c) => c.def.id)).toEqual(["rank", "apply"]);
	});

	it("unblocks on a URL alone, since /rank can fetch it", () => {
		expect(
			commandsFor(job({ status: "new", url: "https://x" })).some(
				(c) => c.blocked,
			),
		).toBe(false);
	});

	it("keeps /rank on a hand-set veto, which is the one command that overrides it", () => {
		expect(ids(job({ status: "skipped" }))).toContain("rank");
	});

	it("offers ranking on an unscored entry at any stage, since the panel says not scored", () => {
		expect(ids(job({ status: "applied", url: "https://x" }))).toContain("rank");
		expect(ids(job({ status: "screening", url: "https://x" }))).toContain(
			"rank",
		);
	});

	it("drops it again once a score exists, where the stage table never offered it", () => {
		expect(
			ids(job({ status: "applied", url: "https://x", rank_score: 71 })),
		).not.toContain("rank");
		// Intake and skipped keep it regardless: re-ranking after a profile change.
		expect(
			ids(job({ status: "ranked", url: "https://x", rank_score: 71 })),
		).toContain("rank");
	});

	it("does not offer interview prep before anyone has applied", () => {
		expect(ids(job({ status: "ranked" }))).not.toContain("interview");
		expect(ids(job({ status: "screening" }))).toContain("interview");
	});

	it("folds a retired status into its column rather than dropping to New's set", () => {
		expect(ids(job({ status: "expired" }))).toEqual(
			ids(job({ status: "skipped" })),
		);
	});
});

describe("stageOf", () => {
	it("names only the three stages /interview prepares for", () => {
		expect(stageOf(job({ status: "screening" }))).toBe("screening");
		expect(stageOf(job({ status: "final_round" }))).toBe("final_round");
		expect(stageOf(job({ status: "applied" }))).toBeUndefined();
		expect(stageOf(job({ status: "offer" }))).toBeUndefined();
	});
});
