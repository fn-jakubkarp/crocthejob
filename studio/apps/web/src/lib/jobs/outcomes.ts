import { isStatus } from "./status";
import type { Job } from "./types";

/**
 * Why an application ended. Freely combinable: one entry went quiet *after* the
 * technical, i.e. `["ghosted", "failed_tech"]`.
 *
 * No tag still reads as "they said no" - that reading predates `declined` and stays
 * for every entry that already has no tags. `declined` and `auto_rejected` say the
 * same thing on purpose, for when which kind of no is worth recording.
 */
export const OUTCOMES = [
	{ id: "ghosted", label: "Ghosted", short: "ghosted", group: "who" },
	{ id: "withdrawn", label: "I withdrew", short: "withdrew", group: "who" },
	{
		id: "on_hold",
		label: "Recruitment on hold",
		short: "on hold",
		group: "who",
	},
	{
		id: "declined",
		label: "Rejected",
		short: "rejected",
		group: "who",
	},
	{
		id: "auto_rejected",
		label: "Automatic rejection",
		short: "auto-reject",
		group: "who",
	},
	{
		id: "failed_screening",
		label: "Failed the screening",
		short: "screening",
		group: "where",
	},
	{
		id: "failed_tech",
		label: "Failed the technical",
		short: "tech",
		group: "where",
	},
	{
		id: "failed_behavioural",
		label: "Failed the behavioural",
		short: "behavioural",
		group: "where",
	},
] as const;

export type OutcomeId = (typeof OUTCOMES)[number]["id"];

/** Headings the two groups sit under. "who" is mostly exclusive, "where" is not. */
export const OUTCOME_GROUPS = [
	{ id: "who", label: "How it ended" },
	{ id: "where", label: "How far it got" },
] as const;

export type OutcomeGroupId = (typeof OUTCOME_GROUPS)[number]["id"];

const byGroup: Record<OutcomeGroupId, (typeof OUTCOMES)[number][]> = {
	who: [],
	where: [],
};
for (const outcome of OUTCOMES) byGroup[outcome.group].push(outcome);

/**
 * The same buckets every group-by-group menu was rebuilding for itself, in OUTCOMES
 * order. The answer is fixed at module load, so no screen re-derives it.
 */
export const OUTCOMES_BY_GROUP: Record<
	OutcomeGroupId,
	readonly (typeof OUTCOMES)[number][]
> = byGroup;

/**
 * Held ids in OUTCOMES order, unknown values dropped - the write side of
 * {@link outcomeTags}, so a stored array never reshuffles between saves either.
 */
export function outcomeIds(held: ReadonlySet<OutcomeId>): OutcomeId[] {
	const ids: OutcomeId[] = [];
	for (const outcome of OUTCOMES)
		if (held.has(outcome.id)) ids.push(outcome.id);
	return ids;
}

/** A retired status as a tag, so a skill-written `ghosted` reads as migrated. */
function impliedOutcome(job: Job): OutcomeId | null {
	if (isStatus(job.status) || !job.status) return null;
	if (job.status === "ghosted") return "ghosted";
	if (job.status === "withdrawn") return "withdrawn";
	return null;
}

/**
 * Stored tags in OUTCOMES order, unknown values dropped. Fixed here rather than
 * taken from the stored array, so a card's chips never reshuffle between saves.
 */
export function outcomeTags(job: Job): (typeof OUTCOMES)[number][] {
	const held = new Set(Array.isArray(job.outcome) ? job.outcome : []);
	// So the column is not half-labelled while a legacy status is still in the file.
	const implied = impliedOutcome(job);
	if (implied) held.add(implied);
	return OUTCOMES.filter((o) => held.has(o.id));
}
