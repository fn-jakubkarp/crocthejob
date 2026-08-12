import { Check, ExternalLink, Kanban } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { OutcomeItems } from "@/components/outcome-menu";
import { Reading } from "@/components/strip";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { externalLink } from "@/lib/external-link";
import {
	COLUMNS,
	columnOf,
	type Job,
	type OutcomeId,
	outcomeTags,
	type Status,
} from "@/lib/jobs";
import { cn } from "@/lib/utils";

/**
 * One posting, on the two plates that print postings rather than totals: a live process
 * to chase, a queued posting about to close. Same anatomy in both, so a name sits in the
 * same place down the page whichever plate it is on.
 *
 * Left-click opens it on the board. Right-click acts on it here - see {@link Menu}.
 */

/**
 * What a row can be done to without leaving the page.
 *
 * The two writes this list asks for are the two the card asks for, in the card's own
 * words: how it ended, and where it goes. `Outcome` is the same rows as the card's -
 * see {@link OutcomeItems} - because naming an ending one thing here and another there
 * is how a vocabulary stops being one, and because which ending it was is the reader's
 * call, not a default worth guessing at.
 *
 * Deliberately not the card's whole menu: that one carries duplicates, deletion, notes
 * and the batch readings, and would need a dialog host per row to do it.
 */
function Menu({
	job,
	onOpen,
	onOutcome,
	onStatus,
}: {
	job: Job;
	onOpen: () => void;
	onOutcome: (key: string, tag: OutcomeId) => void;
	onStatus: (key: string, status: Status) => void;
}) {
	const current = columnOf(job);
	const held = new Set(outcomeTags(job).map((tag) => tag.id));

	return (
		<ContextMenuContent>
			<ContextMenuItem onClick={onOpen}>
				<Kanban />
				Show on the board
			</ContextMenuItem>
			{job.url && (
				<ContextMenuItem {...externalLink(job.url)}>
					<ExternalLink />
					Open the posting
				</ContextMenuItem>
			)}

			<ContextMenuSeparator />

			{/* Tagging is the same gesture as closing it, so a tag moves the entry in one
			    write - see `toggleOutcome`, and the undo is on the toast. */}
			<ContextMenuSub>
				<ContextMenuSubTrigger>Outcome</ContextMenuSubTrigger>
				<ContextMenuSubContent>
					<OutcomeItems held={held} onPick={(tag) => onOutcome(job.key, tag)} />
				</ContextMenuSubContent>
			</ContextMenuSub>

			<ContextMenuSub>
				<ContextMenuSubTrigger>Move to</ContextMenuSubTrigger>
				<ContextMenuSubContent>
					{COLUMNS.map((col) => (
						<ContextMenuItem
							key={col.status}
							// Listed but disabled, so no row moves between openings.
							disabled={col.status === current}
							onClick={() => onStatus(job.key, col.status)}
						>
							{col.status === current ? <Check /> : <span className="w-4" />}
							{col.label}
						</ContextMenuItem>
					))}
				</ContextMenuSubContent>
			</ContextMenuSub>
		</ContextMenuContent>
	);
}

export type RowActions = {
	onOpen: (status: Status, query?: string) => void;
	/** Tags the entry and closes it in one write. */
	onOutcome: (key: string, tag: OutcomeId) => void;
	onStatus: (key: string, status: Status) => void;
};

export function Row({
	job,
	lamp,
	name,
	note,
	noteColour,
	reading,
	urgent,
	label,
	open,
	onOutcome,
	onStatus,
}: {
	job: Job;
	/**
	 * The dot, in the colour of whatever the row's `note` says - the stage it is at, the
	 * band it scored. One meaning per dot: urgency is the reading's own amber, and a dot
	 * that switched colour for the wait made blue and amber look like two kinds of thing.
	 */
	lamp: string;
	name: string;
	note: ReactNode;
	noteColour?: string;
	reading: ReactNode;
	/** Past the threshold this region measures - the reading turns amber. */
	urgent: boolean;
	label: string;
	open: () => void;
	onOutcome: (key: string, tag: OutcomeId) => void;
	onStatus: (key: string, status: Status) => void;
}) {
	return (
		<li>
			<ContextMenu>
				<ContextMenuTrigger
					render={<button type="button" />}
					onClick={open}
					className="flex w-full items-center gap-2 rounded-key px-2 py-[3px] text-left transition-colors duration-150 ease-out hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal"
				>
					<span
						aria-hidden
						className="lamp size-[7px] shrink-0"
						style={{ "--lamp": lamp } as CSSProperties}
					/>
					<span className="text-ink-2 min-w-0 flex-1 truncate text-body font-medium">
						{name}
					</span>
					<span className="shrink-0 text-meta" style={{ color: noteColour }}>
						{note}
					</span>
					{/* The word rides with the colour: nothing here rests on the amber alone. */}
					<Reading
						value={reading}
						size="text-meta"
						className={cn(
							"w-[5.25rem] shrink-0 text-right",
							urgent ? "text-[var(--lamp-mid-ink)]" : "text-muted-foreground",
						)}
					/>
					<span className="sr-only">{label}</span>
				</ContextMenuTrigger>

				<Menu
					job={job}
					onOpen={open}
					onOutcome={onOutcome}
					onStatus={onStatus}
				/>
			</ContextMenu>
		</li>
	);
}

/** What sits over a strip of rows, and where the ones the cap dropped can be read. */
export function Region({
	label,
	reading,
	empty,
	cap,
	onAll,
	className,
	children,
}: {
	label: string;
	/**
	 * A figure the rows below cannot be read for - what the cap dropped, what is already
	 * gone. Omitted where it would only be the row count again, which is a number the
	 * reader already has by looking at it.
	 */
	reading?: string;
	/** What the region says when it holds nothing, which here is the good outcome. */
	empty: string;
	/** Rows printed before it defers to the board. The recommendation, not the queue. */
	cap: number;
	onAll: () => void;
	className?: string;
	children: ReactNode[];
}) {
	const rest = children.length - cap;
	return (
		<div className={cn("flex flex-col", className)}>
			<div className="mb-1 flex shrink-0 items-baseline gap-3">
				<span className="legend text-muted-foreground text-legend">
					{label}
				</span>
				{reading && (
					<span className="legend text-muted-foreground ml-auto shrink-0 text-legend tabular-nums">
						{reading}
					</span>
				)}
			</div>
			{children.length === 0 ? (
				<p className="label text-muted-foreground py-4 text-center text-legend">
					{empty}
				</p>
			) : (
				<>
					<ul className="-mx-2 min-h-0 overflow-y-auto">
						{children.slice(0, cap)}
					</ul>
					{rest > 0 && (
						<button
							type="button"
							onClick={onAll}
							className="legend text-muted-foreground -mx-2 mt-0.5 shrink-0 rounded-key px-2 py-1 text-left text-legend tabular-nums transition-colors duration-150 ease-out hover:bg-surface hover:text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal"
						>
							{rest} more on the board
						</button>
					)}
				</>
			)}
		</div>
	);
}
