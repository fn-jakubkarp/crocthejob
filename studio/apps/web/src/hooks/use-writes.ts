import { staleAfterMove } from "@jobsearch/jobs-data";
import { type CSSProperties, useCallback, useMemo } from "react";
import { toast } from "sonner";
import type { JobsStore } from "@/hooks/use-jobs";
import type { Selection } from "@/hooks/use-selection";
import { oneLine } from "@/lib/board";
import {
	columnOf,
	inverse,
	type Job,
	type JobChanges,
	merged,
} from "@/lib/jobs";
import { HUE, STATUS_HUE } from "@/lib/strip";

/**
 * What a status change silently sweeps up, said in the toast rather than left for the
 * owner to notice missing. The rejection is one thing to a reader, so its date and its
 * tags collapse into a single noun.
 */
const CLEARED: Record<string, string> = {
	applied_date: "applied date",
	screening_date: "screening date",
	tech_interview_date: "interview date",
	final_round_date: "final round date",
	offer_date: "offer date",
	rejected_date: "rejection",
	outcome: "rejection",
};

/** "Cleared the screening date and the rejection". Empty when nothing was cleared. */
function clearedLine(job: Job, changes: JobChanges): string {
	// Same guard as `apply`: a write restating the status it already has clears nothing.
	if (!changes.status || changes.status === job.status) return "";
	const nouns = [
		...new Set(
			staleAfterMove(job, changes.status, changes).map((f) => CLEARED[f]),
		),
	];
	if (nouns.length === 0) return "";
	const last = nouns.pop();
	const head = nouns.map((noun) => `the ${noun}`).join(", ");
	return `Cleared ${head ? `${head} and ` : ""}the ${last}`;
}

/**
 * The toast in the colour of the stage it reports, and gradiented across the move when
 * the write was one - the same eight hues the timeline and the stats pages run on, so a
 * stage is one colour everywhere it appears. See `.toast-hue` in index.css.
 *
 * `from` omitted is a write that did not move anything, and a batch, where the ten
 * entries did not all come from the same column.
 */
function hued(to: JobChanges, from?: Job) {
	const landed = to.status;
	if (!landed) return {};
	return {
		className: "toast-hue",
		style: {
			"--evt": HUE[STATUS_HUE[landed]],
			...(from ? { "--evt-from": HUE[STATUS_HUE[columnOf(from)]] } : {}),
		} as CSSProperties,
	};
}

export type Writes = {
	/** One entry, with its success line. No-op if the key has left the list. */
	one: (
		key: string,
		changes: JobChanges,
		/** What the error toast calls this write. */
		failed: string,
		said: (job: Job) => string,
		/** The toast's second line. Defaults to the title. */
		description?: string,
	) => void;
	/** The whole selection in one write, cleared once it lands. */
	many: (keys: string[], changes: JobChanges, phrase: string) => void;
};

/**
 * The two shapes every board action ends in. Split out because the actions and the
 * status prompts both need them, and it is the one place deciding what success says.
 */
export function useWrites(store: JobsStore, selection: Selection): Writes {
	const { find, mutate, batch, edits } = store;
	const { clear } = selection;

	const one = useCallback<Writes["one"]>(
		(key, changes, failed, said, description) => {
			const job = find(key);
			if (!job) return;
			// Both read before the write: `staleAfterMove` and the undo need the entry as
			// it still is, and after the write that reading is gone.
			const cleared = clearedLine(job, changes);
			const back = inverse(job, changes);
			void mutate(key, changes, failed)
				.then(() =>
					toast.success(said(job), {
						description: cleared || description || oneLine(job.title),
						...hued(changes, job),
						action: {
							label: "Undo",
							onClick: () => {
								void mutate(key, back, "Undo")
									.then(() =>
										toast.success("Put back", {
											description: oneLine(job.title),
											// The move run the other way: out of where the write
											// left it, back into the colour it had.
											...hued(back, merged(job, changes)),
										}),
									)
									.catch(() => {});
							},
						},
					}),
				)
				.catch(() => {});
		},
		[find, mutate],
	);

	const many = useCallback<Writes["many"]>(
		(keys, changes, phrase) => {
			// One line for the batch, not one per entry: which of the ten it was is on
			// the cards themselves once the write lands.
			const swept = keys.some((key) => {
				const job = find(key);
				return !!job && clearedLine(job, changes) !== "";
			});
			// One inverse per entry, since the ten were not all in the same column.
			const back = keys.flatMap((key) => {
				const job = find(key);
				return job ? [{ key, ...inverse(job, changes) }] : [];
			});
			const said = swept ? `${phrase} · later dates cleared` : phrase;
			void batch(keys, changes, said).then((ok) => {
				if (!ok) return;
				clear();
				toast.success(`${keys.length} ${said}`, {
					// No gradient: the selection did not all come from one column.
					...hued(changes),
					action: back.length
						? {
								label: "Undo",
								onClick: () => {
									void edits(back, `${back.length} put back`, "Undo");
								},
							}
						: undefined,
				});
			});
		},
		[batch, clear, edits, find],
	);

	// Stable, so the card callbacks built on it are too - what lets JobCard's `memo`
	// hold across a board re-render.
	return useMemo(() => ({ one, many }), [one, many]);
}
