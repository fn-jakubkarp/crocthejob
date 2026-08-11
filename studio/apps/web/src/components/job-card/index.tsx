import { memo, useCallback, useState } from "react";
import { toast } from "sonner";
import { DeleteDialog } from "@/components/delete-dialog";
import { DismissDialog } from "@/components/dismiss-dialog";
import { CardFace } from "@/components/job-card/card-face";
import { CardMenu } from "@/components/job-card/card-menu";
import { tileClass } from "@/components/job-card/tile";
import { JobDetails } from "@/components/job-details";
import { SavePostingDialog } from "@/components/save-posting-dialog";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { beginDrag, dragGhost, endDrag } from "@/lib/drag-state";
import {
	DRAG_TYPE,
	type DupCopy,
	type Job,
	type JobChanges,
	type Lane,
	type OutcomeId,
	type Status,
	scoreLamp,
} from "@/lib/jobs";

type Props = {
	job: Job;
	lane: Lane;
	/** Set only when this card is a copy, i.e. "Show duplicates" is on. */
	copy?: DupCopy;
	copies?: DupCopy[];
	onLinkDuplicate: (job: Job) => void;
	onUnlinkDuplicate: (key: string) => void;
	onStatus: (key: string, status: Status) => void;
	onNotes: (key: string, notes: string) => Promise<void>;
	onEdit: (job: Job, focus?: "url") => void;
	/** Leaves the board for the document reader, on that entry's saved posting. */
	onReadPosting: (path: string) => void;
	/** Status + reason in one write: Skipped, reason into `notes`. */
	onDismiss: (key: string, reason: string) => void;
	/** Drops the entry from the file. Offered on hand-added entries only. */
	onDelete: (key: string) => void;
	/** A JD typed in by hand. Rethrows, so the dialog can stay open. */
	onSavePosting: (key: string, text: string) => Promise<void>;
	selected: boolean;
	selectionSize: number;
	/** `range` = shift-click: extend from the last card toggled in this column. */
	onSelect: (key: string, mode: "toggle" | "range") => void;
	onBatchStatus: (status: Status) => void;
	onBatchDismiss: () => void;
	/** Toggles one tag; moves to Rejected if not there yet. */
	onOutcome: (key: string, tag: OutcomeId) => void;
	onClearOutcome: (key: string) => void;
	onBatchOutcome: (tag: OutcomeId) => void;
	onPatch: (key: string, changes: JobChanges) => void;
};

/**
 * Native HTML5 drag, not a drag library: React renders nothing between dragstart
 * and drop, so cost is card-count independent. `memo` for the same reason.
 */
export const JobCard = memo(function JobCard({
	job,
	lane,
	copy: duplicateOf,
	copies,
	onLinkDuplicate,
	onUnlinkDuplicate,
	onStatus,
	onNotes,
	onEdit,
	onReadPosting,
	onDismiss,
	onDelete,
	onSavePosting,
	selected,
	selectionSize,
	onSelect,
	onBatchStatus,
	onBatchDismiss,
	onOutcome,
	onClearOutcome,
	onBatchOutcome,
	onPatch,
}: Props) {
	const [open, setOpen] = useState(false);
	const [dismissing, setDismissing] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [addingPosting, setAddingPosting] = useState(false);
	// Right-click on a selected card acts on the selection, else on that card alone.
	const batch = selected && selectionSize > 1;
	const score = job.rank_score;
	const lamp =
		typeof score === "number" ? scoreLamp(score) : (job.fit ?? "low");

	const handleStatus = useCallback(
		(status: Status) => {
			setOpen(false);
			onStatus(job.key, status);
		},
		[job.key, onStatus],
	);

	const handleNotes = useCallback(
		(notes: string) => onNotes(job.key, notes),
		[job.key, onNotes],
	);

	const handleEdit = useCallback(
		(focus?: "url") => {
			setOpen(false);
			onEdit(job, focus);
		},
		[job, onEdit],
	);

	const handleAddPosting = useCallback(() => {
		setOpen(false);
		setAddingPosting(true);
	}, []);

	// Guarded rather than assumed: the button is disabled without a file, and this is
	// also reachable from the popover being open while /scrape rewrites the entry.
	const handleReadPosting = useCallback(() => {
		if (!job.posting_file) return;
		setOpen(false);
		onReadPosting(job.posting_file);
	}, [job.posting_file, onReadPosting]);

	const handleDismiss = useCallback(
		(reason: string) => onDismiss(job.key, reason),
		[job.key, onDismiss],
	);

	const handleOutcome = useCallback(
		(tag: OutcomeId) => onOutcome(job.key, tag),
		[job.key, onOutcome],
	);

	const handleClearOutcome = useCallback(
		() => onClearOutcome(job.key),
		[job.key, onClearOutcome],
	);

	/** Modifier-click selects; a plain click still opens the details. */
	const onClickCapture = useCallback(
		(e: React.MouseEvent) => {
			const range = e.shiftKey;
			if (!range && !e.metaKey && !e.ctrlKey) return;
			// Capture + stopPropagation: base-ui's trigger must not see the click, or the
			// popover opens behind the selection.
			e.preventDefault();
			e.stopPropagation();
			onSelect(job.key, range ? "range" : "toggle");
		},
		[job.key, onSelect],
	);

	// `navigator.clipboard` is absent on non-secure origins, and this runs on plain
	// http://localhost - hence the toast on rejection.
	const copyText = useCallback((text: string, what: string) => {
		navigator.clipboard.writeText(text).then(
			() => toast.success(`${what} copied`),
			(e: unknown) =>
				toast.error(`Could not copy the ${what.toLowerCase()}`, {
					description: e instanceof Error ? e.message : String(e),
				}),
		);
	}, []);

	const onDragStart = useCallback(
		(e: React.DragEvent<HTMLElement>) => {
			e.dataTransfer.setData(DRAG_TYPE, job.key);
			e.dataTransfer.effectAllowed = "move";
			// Pin the ghost to the cursor; Chromium's own offset reads as lag.
			const rect = e.currentTarget.getBoundingClientRect();
			e.dataTransfer.setDragImage(
				dragGhost(e.currentTarget, rect.width),
				e.clientX - rect.left,
				e.clientY - rect.top,
			);
			beginDrag(e.currentTarget);
			setOpen(false);
		},
		[job.key],
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			{/* Context menu wraps the popover trigger so one node is the card: right-click
			    menu, left-click details, drag handlers. base-ui merges via `render`. */}
			<ContextMenu>
				<ContextMenuTrigger
					draggable
					// How drag-state.ts finds this tile after a drop.
					data-key={job.key}
					onDragStart={onDragStart}
					onDragEnd={endDrag}
					onClickCapture={onClickCapture}
					// `aria-selected` is only valid on option/row/tab/gridcell, so on this
					// button it announced nothing. The ring keys off the data attribute.
					data-selected={selected || undefined}
					aria-pressed={selected}
					render={<PopoverTrigger />}
					className={tileClass(lane, lamp, open, !!duplicateOf)}
				>
					<CardFace job={job} lane={lane} copy={duplicateOf} copies={copies} />
				</ContextMenuTrigger>

				<CardMenu
					job={job}
					copy={duplicateOf}
					copies={copies}
					batch={batch}
					selectionSize={selectionSize}
					onCopyText={copyText}
					onOpenDetails={() => setOpen(true)}
					onEdit={handleEdit}
					onSkip={() => setDismissing(true)}
					onDelete={() => setDeleting(true)}
					onStatus={onStatus}
					onBatchStatus={onBatchStatus}
					onOutcome={onOutcome}
					onBatchOutcome={onBatchOutcome}
					onClearOutcome={onClearOutcome}
					onLinkDuplicate={onLinkDuplicate}
					onUnlinkDuplicate={onUnlinkDuplicate}
					onBatchDismiss={onBatchDismiss}
				/>
			</ContextMenu>

			<PopoverContent align="start" side="right" className="w-[25rem] p-4">
				{/* Mounted only while open, so the notes state is per-open. */}
				<JobDetails
					job={job}
					copy={duplicateOf}
					copies={copies}
					onStatus={handleStatus}
					onNotes={handleNotes}
					onEdit={handleEdit}
					onReadPosting={handleReadPosting}
					onAddPosting={handleAddPosting}
					onUnlinkDuplicate={onUnlinkDuplicate}
					onOutcome={handleOutcome}
					onClearOutcome={handleClearOutcome}
					onPatch={(changes) => onPatch(job.key, changes)}
				/>
			</PopoverContent>

			<DismissDialog
				job={job}
				open={dismissing}
				onOpenChange={setDismissing}
				onConfirm={handleDismiss}
			/>

			<SavePostingDialog
				job={job}
				open={addingPosting}
				onOpenChange={setAddingPosting}
				onConfirm={onSavePosting}
			/>

			{/* Not gated on `deleting`: base-ui portals nothing while closed, and
			    unmounting on close cuts the exit animation off mid-fade. */}
			<DeleteDialog
				job={job}
				open={deleting}
				onOpenChange={setDeleting}
				onConfirm={() => onDelete(job.key)}
				copies={copies?.length ?? 0}
			/>
		</Popover>
	);
});
