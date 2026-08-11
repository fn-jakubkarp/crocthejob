import { DismissDialog } from "@/components/dismiss-dialog";
import { DuplicateLinkDialog } from "@/components/duplicate-link-dialog";
import { DuplicateReview } from "@/components/duplicate-review";
import { JobFormDialog } from "@/components/job-form-dialog";
import { RejectDialog } from "@/components/reject-dialog";
import { StageDateDialog } from "@/components/stage-date-dialog";
import type { Dialogs } from "@/hooks/use-dialogs";
import type { JobActions } from "@/hooks/use-job-actions";
import type { JobsStore } from "@/hooks/use-jobs";
import type { StatusFlow } from "@/hooks/use-status-flow";
import type { Job } from "@/lib/jobs";

type Props = {
	/** The whole list: a dialog opened on keys reads its current entry from here. */
	jobs: Job[];
	dialogs: Dialogs;
	flow: StatusFlow;
	actions: JobActions;
	store: JobsStore;
	/** Company+title matches waiting on an answer. */
	suggestions: Job[][];
	/** How many cards the batch dialogs are about. */
	selected: number;
};

/**
 * Every dialog the board can open, gathered here rather than next to what opens them:
 * each is state-driven, several have more than one entry point, none renders closed.
 */
export function BoardDialogs({
	jobs,
	dialogs,
	flow,
	actions,
	store,
	suggestions,
	selected,
}: Props) {
	const at = (key: string | undefined) =>
		key === undefined ? undefined : jobs.find((j) => j.key === key);

	return (
		<>
			<JobFormDialog
				open={dialogs.adding || dialogs.editing !== null}
				onOpenChange={(open) => {
					if (!open) dialogs.closeForm();
				}}
				job={dialogs.editing}
				focusField={dialogs.editFocus}
				onCreate={store.addJob}
				onSave={actions.saveEdits}
			/>

			<DuplicateReview
				open={dialogs.reviewing}
				onOpenChange={dialogs.setReviewing}
				groups={suggestions}
				onConfirm={(edits) => void store.saveReview(edits)}
			/>

			<DuplicateLinkDialog
				job={dialogs.linking}
				onOpenChange={(open) => {
					if (!open) dialogs.setLinking(null);
				}}
				jobs={jobs}
				onConfirm={actions.linkDuplicate}
			/>

			<RejectDialog
				open={flow.rejecting !== null}
				onOpenChange={(open) => {
					if (!open) flow.closeReject();
				}}
				job={flow.rejecting?.length === 1 ? at(flow.rejecting[0]) : undefined}
				count={flow.rejecting?.length}
				onConfirm={flow.confirmReject}
			/>

			<StageDateDialog
				open={flow.stagePrompt !== null}
				onOpenChange={(open) => {
					if (!open) flow.closeStage();
				}}
				job={
					flow.stagePrompt?.keys.length === 1
						? at(flow.stagePrompt.keys[0])
						: undefined
				}
				count={flow.stagePrompt?.keys.length}
				status={flow.stagePrompt?.status}
				onConfirm={flow.confirmStageDate}
			/>

			<DismissDialog
				open={dialogs.dismissing}
				onOpenChange={dialogs.setDismissing}
				onConfirm={actions.batchDismiss}
				count={selected}
			/>
		</>
	);
}
