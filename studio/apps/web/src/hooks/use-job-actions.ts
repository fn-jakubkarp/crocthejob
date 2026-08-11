import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import type { JobsStore } from "@/hooks/use-jobs";
import type { Selection } from "@/hooks/use-selection";
import { type StatusFlow, useStatusFlow } from "@/hooks/use-status-flow";
import { useWrites } from "@/hooks/use-writes";
import { oneLine } from "@/lib/board";
import {
	COLUMN_LABEL,
	columnOf,
	type JobChanges,
	OUTCOMES,
	type OutcomeId,
	outcomeIds,
	outcomeTags,
	type Status,
} from "@/lib/jobs";

/** Everything a card, a column or the selection bar can ask for. */
export type JobActions = {
	changeStatus: (key: string, status: Status) => void;
	changeNotes: (key: string, notes: string) => Promise<void>;
	dismiss: (key: string, reason: string) => void;
	toggleOutcome: (key: string, tag: OutcomeId) => void;
	clearOutcome: (key: string) => void;
	linkDuplicate: (key: string, canonicalKey: string) => void;
	unlinkDuplicate: (key: string) => void;
	/** A field the card edits in place - a stage date, so far. */
	patch: (key: string, changes: JobChanges) => void;
	/** Rethrows, so the dialog can stay open. */
	saveEdits: (key: string, changes: JobChanges) => Promise<void>;
	/** A JD typed in by hand. Rethrows, so the dialog can stay open. */
	savePosting: (key: string, text: string) => Promise<void>;
	/** Drops a hand-added entry outright. Offered on those only - see `isManual`. */
	remove: (key: string) => void;
	batchStatus: (status: Status) => void;
	batchDismiss: (reason: string) => void;
	batchOutcome: (tag: OutcomeId) => void;
};

const labelOf = (id: OutcomeId) =>
	OUTCOMES.find((o) => o.id === id)?.label.toLowerCase() ?? id;

/**
 * Every write the board can make, as card callbacks. The two that ask a question
 * first - Rejected and the live stages - are finished by `useStatusFlow`'s dialogs.
 */
export function useJobActions(
	store: JobsStore,
	selection: Selection,
): { actions: JobActions; flow: StatusFlow } {
	const { find, mutate, removeJob, savePosting } = store;
	const { keys: selected } = selection;
	const writes = useWrites(store, selection);
	const { flow, intercept } = useStatusFlow(writes);

	const changeStatus = useCallback(
		(key: string, status: Status) => {
			const job = find(key);
			if (!job || columnOf(job) === status) return;
			if (intercept([key], status)) return;
			writes.one(
				key,
				{ status },
				"Status change",
				(j) => `${j.company ?? "Job"} → ${COLUMN_LABEL[status]}`,
			);
		},
		[find, intercept, writes],
	);

	const changeNotes = useCallback(
		(key: string, notes: string) =>
			mutate(key, { notes }, "Saving the note").catch(() => {}),
		[mutate],
	);

	/**
	 * Status and reason in one PATCH, so nothing sits in Skipped without a reason.
	 * Ruled out, passed over and closed share the column; *why* is the note.
	 */
	const dismiss = useCallback(
		(key: string, reason: string) => {
			writes.one(
				key,
				{ status: "skipped", notes: reason },
				"Skip",
				(j) => `${j.company ?? "Job"} → Skipped`,
				oneLine(reason),
			);
		},
		[writes],
	);

	/**
	 * Toggles one tag. On a live card it also closes the entry - one decision, one
	 * PATCH, so nothing sits tagged but still open.
	 */
	const toggleOutcome = useCallback(
		(key: string, tag: OutcomeId) => {
			const job = find(key);
			if (!job) return;
			const held = new Set(outcomeTags(job).map((t) => t.id));
			const on = held.has(tag);
			if (on) held.delete(tag);
			else held.add(tag);
			const outcome = outcomeIds(held);
			// Raw status, not the column: an unmigrated `ghosted` entry already renders
			// under Rejected but still needs the status rewritten.
			const closing = job.status !== "rejected";
			const label = labelOf(tag);
			writes.one(
				key,
				closing ? { status: "rejected", outcome } : { outcome },
				"Outcome change",
				(j) =>
					closing
						? `${j.company ?? "Job"} → Rejected · ${label}`
						: `${j.company ?? "Job"} · ${on ? "cleared" : "tagged"} ${label}`,
			);
		},
		[find, writes],
	);

	/** Back to the plain "they said no" reading. */
	const clearOutcome = useCallback(
		(key: string) => {
			writes.one(
				key,
				{ outcome: [] },
				"Outcome change",
				(j) => `${j.company ?? "Job"} · they just said no`,
			);
		},
		[writes],
	);

	/**
	 * Files an entry under another. The server resolves the target's own canonical, so
	 * picking a copy still lands on the entry that stays visible.
	 */
	const linkDuplicate = useCallback(
		(key: string, canonicalKey: string) => {
			const target = find(canonicalKey);
			if (!target) return;
			writes.one(
				key,
				{ duplicate_of: canonicalKey },
				"Linking the duplicate",
				(j) => `#${j.id ?? "?"} filed under #${target.id ?? "?"}`,
				oneLine(target.title),
			);
		},
		[find, writes],
	);

	/**
	 * Puts a hidden copy back. Writes `null` rather than deleting the field - that is
	 * what stops the suggestion returning on the next load.
	 */
	const unlinkDuplicate = useCallback(
		(key: string) => {
			writes.one(
				key,
				{ duplicate_of: null },
				"Unlinking the duplicate",
				(j) => `#${j.id ?? "?"} back on the board`,
			);
		},
		[writes],
	);

	const patch = useCallback(
		(key: string, changes: JobChanges) => {
			void mutate(key, changes, "Status update").catch(() => {});
		},
		[mutate],
	);

	/**
	 * Rethrown, so the dialog stays open with the text intact and shows the server's
	 * reason - in practice a URL another entry already holds.
	 */
	const saveEdits = useCallback(
		async (key: string, changes: JobChanges) => {
			const job = find(key);
			await mutate(key, changes, "Edit");
			toast.success(`${changes.company ?? job?.company ?? "Posting"} updated`, {
				description: Object.keys(changes)
					.map((field) => field.replace(/_/g, " "))
					.join(", "),
			});
		},
		[find, mutate],
	);

	const remove = useCallback(
		(key: string) => {
			void removeJob(key);
		},
		[removeJob],
	);

	const batchStatus = useCallback(
		(status: Status) => {
			const keys = [...selected];
			if (intercept(keys, status)) return;
			writes.many(keys, { status }, `moved to ${COLUMN_LABEL[status]}`);
		},
		[intercept, selected, writes],
	);

	const batchDismiss = useCallback(
		(reason: string) =>
			writes.many(
				[...selected],
				{ status: "skipped", notes: reason },
				"moved to Skipped",
			),
		[selected, writes],
	);

	/**
	 * One tag across the selection, replacing whatever each entry held - the "these 41
	 * all went quiet" case, not a per-card toggle.
	 */
	const batchOutcome = useCallback(
		(tag: OutcomeId) => {
			writes.many(
				[...selected],
				{ status: "rejected", outcome: [tag] },
				`marked Rejected · ${labelOf(tag)}`,
			);
		},
		[selected, writes],
	);

	const actions = useMemo(
		() => ({
			changeStatus,
			changeNotes,
			dismiss,
			toggleOutcome,
			clearOutcome,
			linkDuplicate,
			unlinkDuplicate,
			patch,
			saveEdits,
			savePosting,
			remove,
			batchStatus,
			batchDismiss,
			batchOutcome,
		}),
		[
			changeStatus,
			changeNotes,
			dismiss,
			toggleOutcome,
			clearOutcome,
			linkDuplicate,
			unlinkDuplicate,
			patch,
			saveEdits,
			savePosting,
			remove,
			batchStatus,
			batchDismiss,
			batchOutcome,
		],
	);

	return { actions, flow };
}
