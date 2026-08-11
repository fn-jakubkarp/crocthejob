import { useCallback, useState } from "react";
import type { Writes } from "@/hooks/use-writes";
import {
	COLUMN_LABEL,
	DATED_STAGES,
	type JobChanges,
	OUTCOMES,
	type OutcomeId,
	type Status,
	stageDateField,
} from "@/lib/jobs";

/**
 * The questions a status change asks before anything is written. Keys, not jobs, so
 * the dialog reads the current entry rather than a copy taken when it opened.
 */
export type StatusFlow = {
	/** On the way into Rejected, waiting on the reason. */
	rejecting: string[] | null;
	/** On the way into a live stage, waiting on the date. */
	stagePrompt: { keys: string[]; status: Status } | null;
	closeReject: () => void;
	closeStage: () => void;
	confirmReject: (outcome: OutcomeId[], note?: string) => void;
	confirmStageDate: (date: string) => void;
};

const shortOf = (id: OutcomeId) =>
	OUTCOMES.find((o) => o.id === id)?.short ?? id;

/**
 * Whether this status asks a question first. True means it has taken the change over,
 * so drag, popover, right-click and selection bar all hand off the same way.
 */
type Intercept = (keys: string[], status: Status) => boolean;

export function useStatusFlow(writes: Writes): {
	flow: StatusFlow;
	intercept: Intercept;
} {
	const [rejecting, setRejecting] = useState<string[] | null>(null);
	const [stagePrompt, setStagePrompt] = useState<{
		keys: string[];
		status: Status;
	} | null>(null);

	/**
	 * Rejected asks *how* it ended - the status alone only says it is over. Live stages
	 * ask for the day, which is rarely the day the card was dragged.
	 */
	const intercept = useCallback<Intercept>((keys, status) => {
		if (status === "rejected") {
			setRejecting(keys);
			return true;
		}
		if (DATED_STAGES.includes(status)) {
			setStagePrompt({ keys, status });
			return true;
		}
		return false;
	}, []);

	/**
	 * Status, tags and - only if edited - the note in one PATCH, so nothing sits in
	 * Rejected with half a reason attached.
	 */
	const confirmReject = useCallback(
		(outcome: OutcomeId[], note?: string) => {
			const keys = rejecting ?? [];
			setRejecting(null);
			if (keys.length === 0) return;
			const changes: JobChanges = {
				status: "rejected",
				outcome,
				...(note === undefined ? {} : { notes: note }),
			};
			const why = outcome.map(shortOf).join(" + ") || "they said no";
			if (keys.length > 1) {
				writes.many(keys, changes, `moved to Rejected · ${why}`);
				return;
			}
			writes.one(
				keys[0],
				changes,
				"Rejection",
				(job) => `${job.company ?? "Job"} → Rejected · ${why}`,
			);
		},
		[rejecting, writes],
	);

	const confirmStageDate = useCallback(
		(date: string) => {
			const info = stagePrompt;
			setStagePrompt(null);
			if (!info || info.keys.length === 0) return;
			const { keys, status } = info;
			const changes: JobChanges = {
				status,
				[stageDateField(status)]: date || undefined,
			};

			if (keys.length > 1) {
				writes.many(keys, changes, `moved to ${COLUMN_LABEL[status]}`);
				return;
			}
			writes.one(
				keys[0],
				changes,
				"Status change",
				(job) => `${job.company ?? "Job"} → ${COLUMN_LABEL[status]}`,
			);
		},
		[stagePrompt, writes],
	);

	const closeReject = useCallback(() => setRejecting(null), []);
	const closeStage = useCallback(() => setStagePrompt(null), []);

	return {
		flow: {
			rejecting,
			stagePrompt,
			closeReject,
			closeStage,
			confirmReject,
			confirmStageDate,
		},
		intercept,
	};
}
