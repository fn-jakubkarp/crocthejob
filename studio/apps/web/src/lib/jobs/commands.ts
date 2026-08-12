import { columnOf, type Status } from "./status";
import type { Job } from "./types";

export type CommandId =
	| "rank"
	| "research"
	| "apply"
	| "interview"
	| "followup";

export type CommandDef = {
	id: CommandId;
	label: string;
	/** What it leaves behind, said in one line under the button. */
	said: string;
	/** True if it cannot start without a posting to read. */
	needsPosting?: boolean;
};

export const COMMANDS: Record<CommandId, CommandDef> = {
	rank: {
		id: "rank",
		label: "Rank",
		said: "Scores the fit and writes the verdict back",
		needsPosting: true,
	},
	research: {
		id: "research",
		label: "Research",
		said: "Company checklist, into research.md",
	},
	apply: {
		id: "apply",
		label: "Tailor CV",
		said: "Drafts the CV for this posting. Stops to ask first",
		needsPosting: true,
	},
	interview: {
		id: "interview",
		label: "Interview prep",
		said: "A prep pack for the stage this entry is at",
		needsPosting: true,
	},
	followup: {
		id: "followup",
		label: "Follow-up",
		said: "Drafts the nudge for an application gone quiet",
	},
};

/**
 * What is worth running against an entry at each stage, in the order it is worth doing.
 *
 * Not every command against every entry: `/interview` on something nobody has applied to
 * writes a prep pack for a conversation that is not happening, and a panel of six buttons
 * where two are meaningful is a panel nobody reads. `/rank` stays on `skipped` on purpose,
 * because it is the one command that overrides a hand-set veto and reporting that it did
 * is the point.
 *
 * Mirrors the server's own table in `run-api.ts`. That one is the boundary that decides
 * what may run; this one only decides what is offered.
 */
const BY_STATUS: Record<Status, CommandId[]> = {
	new: ["rank", "research", "apply"],
	ranked: ["rank", "research", "apply"],
	applied: ["research", "followup"],
	screening: ["interview", "research"],
	tech_interview: ["interview", "research"],
	final_round: ["interview", "research"],
	offer: ["research"],
	// Nothing. `/outcome` is the debrief and it stays a terminal command: everything
	// the board could offer here - the status, the stage dates, the outcome tags - is
	// already a control in the panel below, and a button that only duplicates them
	// reads as the whole skill being pointless. See PRODUCT.md.
	rejected: [],
	skipped: ["rank"],
	dismissed: ["rank"],
	expired: ["rank"],
};

/**
 * The commands offered for one entry, each with the reason it cannot run if it cannot.
 *
 * A blocked command stays visible rather than disappearing: "Rank needs a description"
 * tells you what to do next, an absent button tells you nothing. And the check is worth
 * making here rather than letting the run fail, because a run that was never going to
 * work still costs a real request against the subscription.
 */
export function commandsFor(job: Job): { def: CommandDef; blocked?: string }[] {
	const readable = Boolean(job.posting_file || job.url);
	const offered = BY_STATUS[columnOf(job)];
	// A panel that reads "not scored" with nothing on it that scores is the panel
	// disagreeing with itself. The stage table decides where ranking is *routine*; an
	// entry that has never been scored gets the button wherever it sits, because that
	// reading is on screen either way.
	const list =
		typeof job.rank_score === "number" || offered.includes("rank")
			? offered
			: (["rank", ...offered] as CommandId[]);

	return list.map((id) => {
		const def = COMMANDS[id];
		return def.needsPosting && !readable
			? { def, blocked: "No description saved and no URL to fetch one from" }
			: { def };
	});
}

/** The `--stage` `/interview` is run with, or nothing if the entry is not at one. */
export function stageOf(job: Job): string | undefined {
	const at = columnOf(job);
	return at === "screening" || at === "tech_interview" || at === "final_round"
		? at
		: undefined;
}
