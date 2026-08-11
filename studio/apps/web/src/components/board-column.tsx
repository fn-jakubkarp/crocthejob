import {
	ArrowDownWideNarrow,
	ArrowUpNarrowWide,
	Funnel,
	FunnelX,
} from "lucide";
import { X } from "lucide-react";
import { MorphIcon } from "morphicons/react";
import {
	type CSSProperties,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { JobCard } from "@/components/job-card";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	DRAG_TYPE,
	type DupIndex,
	effectiveSort,
	type Job,
	type JobChanges,
	LANE_SORTS,
	type Lane,
	OUTCOME_GROUPS,
	OUTCOMES,
	OUTCOMES_BY_GROUP,
	type OutcomeId,
	outcomeTags,
	SORTS,
	type SortId,
	type Status,
} from "@/lib/jobs";
import { HUE, STATUS_HUE } from "@/lib/strip";
import { cn } from "@/lib/utils";

/** Columns render a slice; `skipped` alone holds 160+ entries. */
const PAGE = 25;

const ASCENDING: Record<SortId, boolean> = {
	updated_desc: false,
	status_date_asc: true,
	score: false,
	fit: false,
	deadline: true,
	outcome: true,
	company: true,
};

/**
 * 24px header buttons, hit area grown to 24×40 with a pseudo-element. Vertical only -
 * they sit flush and must not overlap.
 */
const HIT_AREA = "relative after:absolute after:-inset-y-2 after:inset-x-0";

/** One thing the user turned on, and the click that turns it back off. */
function Chip({
	label,
	title,
	onClear,
}: {
	label: string;
	title: string;
	onClear: () => void;
}) {
	return (
		<span className="text-ink-2 flex min-w-0 items-center gap-1 rounded-chip border border-border bg-card py-1 pr-1 pl-2 text-body leading-none font-medium">
			<span className="truncate">{label}</span>
			{/* Only the X clears. The 14px glyph carries a 4px invisible ring so the
			    pointer does not have to land on the strokes. */}
			<button
				type="button"
				onClick={onClear}
				title={title}
				aria-label={title}
				className="text-muted-foreground hover:text-foreground hover:bg-card-hover relative flex shrink-0 items-center justify-center rounded-[3px] p-0.5 transition-[background-color,color] duration-150 ease-out after:absolute after:-inset-1 focus-visible:outline-signal focus-visible:outline-2 focus-visible:outline-offset-1"
			>
				<X className="size-3.5" />
			</button>
		</span>
	);
}

type Props = {
	status: Status;
	label: string;
	lane: Lane;
	/** What this column says when empty. See COLUMNS in lib/jobs.ts. */
	empty: string;
	jobs: Job[];
	/** Total before filtering, so the header can say a filter is hiding rows. */
	totalUnfiltered: number;
	/** See `buildDupIndex`. */
	dupes: DupIndex;
	onLinkDuplicate: (job: Job) => void;
	onUnlinkDuplicate: (key: string) => void;
	sort: SortId;
	onSort: (status: Status, sort: SortId) => void;
	onDrop: (key: string, status: Status) => void;
	onStatus: (key: string, status: Status) => void;
	onNotes: (key: string, notes: string) => Promise<void>;
	onEdit: (job: Job, focus?: "url") => void;
	onReadPosting: (path: string) => void;
	onDismiss: (key: string, reason: string) => void;
	onDelete: (key: string) => void;
	/** A JD typed in by hand. Rethrows, so the dialog can stay open. */
	onSavePosting: (key: string, text: string) => Promise<void>;
	/** Keys held across the whole board, not just this column. */
	selected: Set<string>;
	onSelect: (key: string, mode: "toggle" | "range") => void;
	onBatchStatus: (status: Status) => void;
	onBatchDismiss: () => void;
	onOutcome: (key: string, tag: OutcomeId) => void;
	onClearOutcome: (key: string) => void;
	onBatchOutcome: (tag: OutcomeId) => void;
	onPatch: (key: string, changes: JobChanges) => void;
};

export function BoardColumn({
	status,
	label,
	lane,
	empty,
	jobs,
	totalUnfiltered,
	dupes,
	onLinkDuplicate,
	onUnlinkDuplicate,
	sort,
	onSort,
	onDrop,
	onStatus,
	onNotes,
	onEdit,
	onReadPosting,
	onDismiss,
	onDelete,
	onSavePosting,
	selected,
	onSelect,
	onBatchStatus,
	onBatchDismiss,
	onOutcome,
	onClearOutcome,
	onBatchOutcome,
	onPatch,
}: Props) {
	const [shown, setShown] = useState(PAGE);
	const [over, setOver] = useState(false);
	// Outcome filter, Rejected only - it is the one column whose cards carry tags.
	const [tags, setTags] = useState<Set<OutcomeId>>(new Set());
	// dragenter/dragleave fire per descendant, so track depth rather than clearing the
	// highlight the first time the pointer crosses a child.
	const depth = useRef(0);

	// dragleave is the only thing that unwinds `depth`, and a cancelled drag is not
	// obliged to deliver one. Without this a column that missed it counts from a
	// non-zero floor and never clears its highlight again.
	useEffect(() => {
		const reset = () => {
			depth.current = 0;
			setOver(false);
		};
		document.addEventListener("dragend", reset, true);
		return () => document.removeEventListener("dragend", reset, true);
	}, []);

	const onDragOver = useCallback((e: React.DragEvent) => {
		if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	}, []);

	const onDragEnter = useCallback((e: React.DragEvent) => {
		if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
		depth.current += 1;
		setOver(true);
	}, []);

	const onDragLeave = useCallback((e: React.DragEvent) => {
		if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
		depth.current -= 1;
		if (depth.current <= 0) {
			depth.current = 0;
			setOver(false);
		}
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			const key = e.dataTransfer.getData(DRAG_TYPE);
			depth.current = 0;
			setOver(false);
			if (!key) return;
			e.preventDefault();
			onDrop(key, status);
		},
		[onDrop, status],
	);

	// The lane's own default, so the chip row only reports a sort the user chose.
	const defaultSort = effectiveSort(lane);

	// Any ticked tag matches, so "ghosted" plus "tech" reads as either, not both.
	const rows = tags.size
		? jobs.filter((job) => outcomeTags(job).some((t) => tags.has(t.id)))
		: jobs;
	const visible = rows.slice(0, shown);
	const filtered = totalUnfiltered !== rows.length;

	const toggleTag = (tag: OutcomeId) =>
		setTags((prev) => {
			const next = new Set(prev);
			if (next.has(tag)) next.delete(tag);
			else next.add(tag);
			return next;
		});

	return (
		// The id is how the stats page scrolls a column into view after sending the
		// user here. See App's `focus` effect.
		<div
			id={`column-${status}`}
			// Every track carries its right rule, the last one included: the sheet
			// needs a line to end on or the board just stops.
			className="flex w-[17rem] shrink-0 flex-col border-r border-border"
		>
			{/* The index bar. Outside the scroll container, so it holds its place down
			    a 160-entry column, and on the surface plane so the row of them reads
			    across the whole board as one ruled strip. */}
			{/* `pt-px` offsets the bottom border: h-11 is the outer height, so without it
			    the centred row sits half a pixel above the middle of the bar. */}
			<div className="bg-surface flex h-11 shrink-0 items-center gap-2 border-b border-border px-3 pt-px">
				{/* The stage's own colour, the same one it carries on the timeline and in
				    the stats - so the row of lamps across the board reads as the pipeline
				    rather than as four generic states. Never the only carrier: the label
				    is next to it. */}
				<span
					aria-hidden
					className="lamp size-[7px] shrink-0"
					style={{ "--lamp": HUE[STATUS_HUE[status]] } as CSSProperties}
				/>
				{/* Both text items trim to cap height and baseline, so the flex row centres
				    the ink itself rather than two line boxes cut from different fonts -
				    Archivo's label and Geist's digits carry different descent, and
				    untrimmed they land on different lines. */}
				<h2 className="label text-ink-2 min-w-0 truncate text-body [text-box:cap_alphabetic]">
					{label}
				</h2>

				{/* Bare, not badged: a count in the data face beside a tracked label is
				    already a reading, and a box around it is one box per column.
				    `matching / total` appears only while a filter hides rows. */}
				<span className="text-ink-2 shrink-0 font-data text-body font-medium tabular-nums [text-box:cap_alphabetic]">
					{rows.length}
					{filtered && (
						<span className="text-muted-foreground font-normal">
							/{totalUnfiltered}
						</span>
					)}
				</span>

				<div className="ml-auto flex items-center gap-0.5">
					{status === "rejected" && (
						<DropdownMenu>
							<Tooltip>
								<TooltipTrigger
									render={
										<DropdownMenuTrigger
											render={
												<Button
													variant="ghost"
													size="icon"
													className={cn(
														"text-muted-foreground hover:text-foreground hover:bg-card aria-expanded:bg-card size-6 rounded-chip",
														tags.size > 0 && "text-signal-ink bg-card",
														HIT_AREA,
													)}
													aria-label={`Filter ${label}`}
												/>
											}
										/>
									}
								>
									{/* Morphs to the crossed funnel while a tag is held, the same
									    way the sort glyph reports its direction. */}
									<MorphIcon
										icon={tags.size > 0 ? FunnelX : Funnel}
										spring="snappy"
										className="size-3.5"
										strokeWidth={2}
									/>
								</TooltipTrigger>
								<TooltipContent side="top">
									{tags.size > 0
										? `Filtered by ${tags.size} outcome${tags.size > 1 ? "s" : ""}`
										: "Filter by outcome"}
								</TooltipContent>
							</Tooltip>
							<DropdownMenuContent align="end" className="w-56">
								{OUTCOME_GROUPS.map((group) => (
									<div key={group.id}>
										<DropdownMenuGroup>
											<DropdownMenuLabel>{group.label}</DropdownMenuLabel>
										</DropdownMenuGroup>
										<DropdownMenuSeparator />
										{OUTCOMES_BY_GROUP[group.id].map((tag) => (
											<DropdownMenuCheckboxItem
												key={tag.id}
												checked={tags.has(tag.id)}
												onCheckedChange={() => toggleTag(tag.id)}
											>
												{tag.label}
											</DropdownMenuCheckboxItem>
										))}
									</div>
								))}
								{tags.size > 0 && (
									<>
										<DropdownMenuSeparator />
										<DropdownMenuItem onClick={() => setTags(new Set())}>
											Clear filter
										</DropdownMenuItem>
									</>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					)}

					<DropdownMenu>
						<Tooltip>
							<TooltipTrigger
								render={
									<DropdownMenuTrigger
										render={
											<Button
												variant="ghost"
												size="icon"
												className={cn(
													"text-muted-foreground hover:text-foreground hover:bg-card aria-expanded:bg-card size-6 rounded-chip",
													HIT_AREA,
												)}
												aria-label={`Sort ${label}`}
											/>
										}
									/>
								}
							>
								{/* The glyph reports the direction, not a generic "sort" badge. */}
								<MorphIcon
									icon={
										ASCENDING[sort] ? ArrowUpNarrowWide : ArrowDownWideNarrow
									}
									spring="snappy"
									className="size-3.5"
									strokeWidth={2}
								/>
							</TooltipTrigger>
							<TooltipContent side="top">
								Sorted by{" "}
								{SORTS.find((s) => s.id === sort)?.label.toLowerCase()}
							</TooltipContent>
						</Tooltip>
						<DropdownMenuContent align="end" className="w-56">
							<DropdownMenuGroup>
								<DropdownMenuLabel>Sort {label} by</DropdownMenuLabel>
							</DropdownMenuGroup>
							<DropdownMenuSeparator />
							<DropdownMenuRadioGroup
								value={sort}
								onValueChange={(v) => onSort(status, v as SortId)}
							>
								{LANE_SORTS[lane].map((s) => (
									<DropdownMenuRadioItem key={s.id} value={s.id}>
										{s.label}
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuRadioGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
			<div
				data-dropzone
				// Highlight lives in index.css: a utility class here loses on specificity
				// to the body[data-dragging] rule.
				data-over={over || undefined}
				onDragOver={onDragOver}
				onDragEnter={onDragEnter}
				onDragLeave={onDragLeave}
				onDrop={handleDrop}
				// Children never squash: the well scrolls, it does not compress cards.
				// The deep bottom padding is scroll runway under the floating dock, so
				// the last card can always be brought clear of it.
				className="bg-background flex flex-1 flex-col gap-1.5 overflow-y-auto px-2.5 pt-2.5 pb-36 transition-colors [&>*]:shrink-0"
			>
				{/* What the user turned on, pinned so it stays reachable down a long
				    column. Nothing active, nothing rendered - no reserved gap.

				    `bg-inherit`, not `bg-background`: a drag tints the track, and a fixed
				    colour here prints a band across the top of it. */}
				{(sort !== defaultSort || tags.size > 0) && (
					<div className="bg-inherit sticky -top-2.5 z-10 -mx-2.5 -mt-2.5 flex flex-wrap items-center gap-1.5 px-2.5 pt-2.5 pb-0.5">
						{sort !== defaultSort && (
							<Chip
								label={SORTS.find((s) => s.id === sort)?.label ?? sort}
								title="Back to the default sort"
								onClear={() => onSort(status, defaultSort)}
							/>
						)}
						{tags.size > 0 && (
							<Chip
								label={
									tags.size === 1
										? (OUTCOMES.find((o) => tags.has(o.id))?.label ?? "")
										: `${tags.size} outcomes`
								}
								title="Clear the outcome filter"
								onClear={() => setTags(new Set())}
							/>
						)}
					</div>
				)}

				{visible.map((job) => (
					<JobCard
						key={job.key}
						job={job}
						lane={lane}
						copy={dupes.of.get(job.key)}
						copies={dupes.copies.get(job.key)}
						onLinkDuplicate={onLinkDuplicate}
						onUnlinkDuplicate={onUnlinkDuplicate}
						onStatus={onStatus}
						onNotes={onNotes}
						onEdit={onEdit}
						onReadPosting={onReadPosting}
						onDismiss={onDismiss}
						onDelete={onDelete}
						onSavePosting={onSavePosting}
						selected={selected.has(job.key)}
						selectionSize={selected.size}
						onSelect={onSelect}
						onBatchStatus={onBatchStatus}
						onBatchDismiss={onBatchDismiss}
						onOutcome={onOutcome}
						onClearOutcome={onClearOutcome}
						onBatchOutcome={onBatchOutcome}
						onPatch={onPatch}
					/>
				))}

				{/* No box: an empty track is already a box, and a plate inside it to say
				    so was one container too many. */}
				{rows.length === 0 && (
					<span className="m-auto px-3 py-2 text-center">
						<span className="label text-muted-foreground block text-legend text-balance">
							{filtered ? "nothing matches the filter" : empty}
						</span>
					</span>
				)}

				{rows.length > shown && (
					<Button
						variant="outline"
						size="sm"
						// Transparent rather than filled: it is a continuation of the
						// track, not another card in it.
						className="mt-1 h-7 w-full shrink-0 bg-transparent text-meta font-medium"
						onClick={() => setShown((n) => n + PAGE)}
					>
						Show {Math.min(PAGE, rows.length - shown)} more
						<span className="text-muted-foreground font-data tabular-nums">
							{rows.length - shown} left
						</span>
					</Button>
				)}
			</div>
		</div>
	);
}
