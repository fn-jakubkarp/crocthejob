import { isManual } from "@jobsearch/jobs-data";
import {
	Ban,
	Check,
	Copy,
	CopyMinus,
	CopyPlus,
	ExternalLink,
	Link2,
	Maximize2,
	NotepadText,
	Pencil,
	Trash2,
} from "lucide-react";
import { OutcomeItems } from "@/components/outcome-menu";
import {
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import { externalLink } from "@/lib/external-link";
import {
	COLUMNS,
	columnOf,
	type DupCopy,
	type Job,
	type OutcomeId,
	outcomeTags,
	type Status,
} from "@/lib/jobs";

type MenuProps = {
	job: Job;
	copy?: DupCopy;
	copies?: DupCopy[];
	/** Right-click on a selected card acts on the selection, else on that card alone. */
	batch: boolean;
	selectionSize: number;
	onCopyText: (text: string, what: string) => void;
	onOpenDetails: () => void;
	/** Leaves the board for the entry's own page. No-ops on an entry without an id. */
	onOpenJob: () => void;
	onEdit: () => void;
	onSkip: () => void;
	/** Opens the confirm; the card owns the dialog. */
	onDelete: () => void;
	onStatus: (key: string, status: Status) => void;
	onBatchStatus: (status: Status) => void;
	onOutcome: (key: string, tag: OutcomeId) => void;
	onBatchOutcome: (tag: OutcomeId) => void;
	onClearOutcome: (key: string) => void;
	onLinkDuplicate: (job: Job) => void;
	onUnlinkDuplicate: (key: string) => void;
	onBatchDismiss: () => void;
};

/** Every action the card offers on right-click, on it or on the whole selection. */
export function CardMenu({
	job,
	copy: duplicateOf,
	copies,
	batch,
	selectionSize,
	onCopyText,
	onOpenDetails,
	onOpenJob,
	onEdit,
	onSkip,
	onDelete,
	onStatus,
	onBatchStatus,
	onOutcome,
	onBatchOutcome,
	onClearOutcome,
	onLinkDuplicate,
	onUnlinkDuplicate,
	onBatchDismiss,
}: MenuProps) {
	const current = columnOf(job);
	const copyCount = copies?.length ?? 0;
	// From the entry, not the Rejected-only list, so a live card's tags show too.
	const heldOutcomes = new Set(outcomeTags(job).map((t) => t.id));
	const label = [job.company, job.title?.replace(/\s+/g, " ").trim()]
		.filter(Boolean)
		.join(" - ");

	return (
		<ContextMenuContent>
			{/* A held selection retitles the menu: the actions act on the selection,
			    not on the card under the cursor. */}
			{batch && (
				<>
					{/* Not ContextMenuLabel: base-ui's is MenuGroupLabel and throws outside
					    a Menu.Group. Decorative - the count repeats in the labels below. */}
					<p
						aria-hidden
						className="text-muted-foreground px-1.5 py-1 text-xs font-medium"
					>
						{selectionSize} selected
					</p>
					<ContextMenuSeparator />
				</>
			)}
			{!batch && job.url && (
				<ContextMenuItem {...externalLink(job.url)}>
					<ExternalLink />
					Open the posting
				</ContextMenuItem>
			)}
			{!batch && job.url && (
				<ContextMenuItem onClick={() => onCopyText(job.url as string, "Link")}>
					<Link2 />
					Copy link
				</ContextMenuItem>
			)}
			{!batch && label && (
				<ContextMenuItem onClick={() => onCopyText(label, "Company and title")}>
					<Copy />
					Copy company and title
				</ContextMenuItem>
			)}
			{!batch && (
				<>
					{/* The full entry first: the description, what has been written for it,
					    and the readings. The popover under it is the fast read. */}
					<ContextMenuItem disabled={job.id === undefined} onClick={onOpenJob}>
						<Maximize2 />
						Open the full entry
					</ContextMenuItem>

					<ContextMenuItem onClick={onOpenDetails}>
						<NotepadText />
						Details and notes
					</ContextMenuItem>

					<ContextMenuItem onClick={onEdit}>
						<Pencil />
						Edit posting
					</ContextMenuItem>

					<ContextMenuSeparator />
				</>
			)}

			<ContextMenuSub>
				<ContextMenuSubTrigger>
					{batch ? `Move ${selectionSize} to` : "Move to"}
				</ContextMenuSubTrigger>
				<ContextMenuSubContent>
					{COLUMNS.map((col) => (
						<ContextMenuItem
							key={col.status}
							// Current stage stays listed but disabled, so a row never moves
							// between cards. A batch spans stages, so nothing is disabled.
							disabled={!batch && col.status === current}
							onClick={() =>
								batch
									? onBatchStatus(col.status)
									: onStatus(job.key, col.status)
							}
						>
							{!batch && col.status === current ? (
								<Check />
							) : (
								<span className="w-4" />
							)}
							{col.label}
						</ContextMenuItem>
					))}
				</ContextMenuSubContent>
			</ContextMenuSub>

			{/* Offered wherever the card sits, not only under Rejected: tagging is
			    usually the same gesture as closing it, so a tag moves it in one write. */}
			<ContextMenuSub>
				<ContextMenuSubTrigger>
					{batch ? `Outcome for ${selectionSize}` : "Outcome"}
				</ContextMenuSubTrigger>
				<ContextMenuSubContent>
					{/* A held selection spans entries with different tags, so no row is ticked. */}
					<OutcomeItems
						held={batch ? null : heldOutcomes}
						onPick={(tag) =>
							batch ? onBatchOutcome(tag) : onOutcome(job.key, tag)
						}
					/>
					{!batch && heldOutcomes.size > 0 && (
						<>
							<ContextMenuSeparator />
							<ContextMenuItem onClick={() => onClearOutcome(job.key)}>
								<span className="w-4" />
								They just said no
							</ContextMenuItem>
						</>
					)}
				</ContextMenuSubContent>
			</ContextMenuSub>

			{!batch && (
				<>
					<ContextMenuSeparator />
					{duplicateOf ? (
						<ContextMenuItem onClick={() => onUnlinkDuplicate(job.key)}>
							<CopyMinus />
							Not a duplicate
						</ContextMenuItem>
					) : (
						<ContextMenuItem onClick={() => onLinkDuplicate(job)}>
							<CopyPlus />
							{copyCount > 0
								? `File under another entry… (holds ${copyCount})`
								: "Mark as a duplicate…"}
						</ContextMenuItem>
					)}
				</>
			)}

			<ContextMenuSeparator />

			{/* Collects the reason; dragging into the column is the no-reason path. Not
			    disabled on an already-skipped card: writing the reason is the point.
			    Not `destructive` either - Skip is a column, and red here would flatten
			    the one row in this menu that cannot be undone. */}
			<ContextMenuItem onClick={() => (batch ? onBatchDismiss() : onSkip())}>
				<Ban />
				{batch ? `Skip ${selectionSize} with a reason…` : "Skip with a reason…"}
			</ContextMenuItem>

			{/* Hand-added entries only. Deleting a scraped one is theatre - the next
			    /scrape puts it straight back. Never offered on a selection: one
			    irreversible thing at a time. */}
			{!batch && isManual(job) && (
				<ContextMenuItem variant="destructive" onClick={onDelete}>
					<Trash2 />
					Delete this entry…
				</ContextMenuItem>
			)}
		</ContextMenuContent>
	);
}
