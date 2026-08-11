import { BoardColumn } from "@/components/board-column";
import type { BoardData } from "@/hooks/use-board-data";
import type { BoardView } from "@/hooks/use-board-view";
import type { Dialogs } from "@/hooks/use-dialogs";
import type { JobActions } from "@/hooks/use-job-actions";
import type { Selection } from "@/hooks/use-selection";

type Props = {
	view: BoardView;
	data: BoardData;
	actions: JobActions;
	selection: Selection;
	dialogs: Dialogs;
	/** Leaves the board: App switches to the reader on that path. */
	onReadPosting: (path: string) => void;
};

/** The columns themselves. Every card callback is threaded through from here. */
export function Board({
	view,
	data,
	actions,
	selection,
	dialogs,
	onReadPosting,
}: Props) {
	const { byColumn } = data;

	return (
		// Tracks, not floating wells: the columns run the full height and are
		// divided by one hairline each, so the board reads as a ruled sheet and the
		// gutters come back as content. The left padding is the rail's fixed
		// footprint, which nothing reflows around. See AppRail.
		<main className="flex flex-1 overflow-x-auto overflow-y-hidden pl-rail">
			{view.shown.map((col) => (
				<BoardColumn
					key={col.status}
					{...col}
					jobs={byColumn.map.get(col.status) ?? []}
					totalUnfiltered={byColumn.totals.get(col.status) ?? 0}
					dupes={data.dupes}
					onLinkDuplicate={dialogs.setLinking}
					onUnlinkDuplicate={actions.unlinkDuplicate}
					sort={view.sortFor(col.status)}
					onSort={view.setColumnSort}
					onDrop={actions.changeStatus}
					onStatus={actions.changeStatus}
					onNotes={actions.changeNotes}
					onEdit={dialogs.openEdit}
					onReadPosting={onReadPosting}
					onDismiss={actions.dismiss}
					onDelete={actions.remove}
					onSavePosting={actions.savePosting}
					selected={selection.keys}
					onSelect={selection.toggle}
					onBatchStatus={actions.batchStatus}
					onBatchDismiss={() => dialogs.setDismissing(true)}
					onOutcome={actions.toggleOutcome}
					onClearOutcome={actions.clearOutcome}
					onBatchOutcome={actions.batchOutcome}
					onPatch={actions.patch}
				/>
			))}
			{view.shown.length === 0 && (
				<div className="m-auto text-center">
					<p className="label text-muted-foreground text-data">
						Every column hidden
					</p>
					<p className="text-muted-foreground mt-1.5 text-body">
						Bring one back from the Columns menu.
					</p>
				</div>
			)}
		</main>
	);
}
