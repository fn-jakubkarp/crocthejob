import { ExternalLink, Ghost } from "lucide-react";
import {
	columnOf,
	type DupCopy,
	deadlineRead,
	type Job,
	type Lane,
	outcomeTags,
	processAge,
	readableMode,
	readableSalary,
	stageAge,
	stageSince,
} from "@/lib/jobs";
import { cn } from "@/lib/utils";

const FIT_INK: Record<string, string> = {
	high: "text-[var(--lamp-high-ink)]",
	medium: "text-[var(--lamp-mid-ink)]",
	low: "text-muted-foreground",
};

const DEADLINE_INK = {
	soon: "text-[var(--lamp-mid-ink)]",
	lapsed: "text-muted-foreground",
	far: "text-muted-foreground",
} as const;

export /**
 * What the tile shows: title, company, the one reading that matters for its lane, and
 * whatever it ended up with. Everything here is derived from the entry - the card
 * holds no state of its own.
 */
function CardFace({
	job,
	lane,
	copy: duplicateOf,
	copies,
}: {
	job: Job;
	lane: Lane;
	copy?: DupCopy;
	copies?: DupCopy[];
}) {
	const current = columnOf(job);
	const archive = lane === "archive";
	const fit = job.fit ?? "low";
	// Local so TypeScript narrows it for `scoreLamp`.
	const score = job.rank_score;
	const scored = typeof score === "number";
	const mode = readableMode(job.work_mode);
	// Deadline only matters pre-application; a live card shows its wait instead.
	const due =
		lane === "intake" && job.rank_deadline
			? deadlineRead(job.rank_deadline)
			: null;
	const since = stageSince(job);
	const age = lane === "live" && since ? stageAge(since, current) : null;
	// Total since applied_date; shown only when it differs from the stage age.
	const total = lane === "live" ? processAge(job) : null;
	const showTotal = total && age && total.days !== age.days;
	const idLabel = duplicateOf?.label ?? (job.id ? `#${job.id}` : null);
	const copyCount = copies?.length ?? 0;
	const outcomes = current === "rejected" ? outcomeTags(job) : [];

	return (
		<>
			<div className="flex items-start gap-1.5">
				{/* Clamped, or a four-line title doubles the card height. Full title is
				    in the popover. */}
				<p
					className={cn(
						"min-w-0 flex-1 font-[620] tracking-[-0.016em] text-pretty",
						archive
							? "line-clamp-1 text-body leading-[1.3]"
							: "line-clamp-2 text-title leading-[1.28]",
					)}
				>
					{job.title?.replace(/\s+/g, " ").trim() || "(untitled)"}
				</p>
				{job.url && (
					// Hit area via pseudo-element, not padding, so it costs no layout.
					// Capped at 34px (under the 40px min) or it eats the card's target.
					<a
						href={job.url}
						target="_blank"
						rel="noreferrer noopener"
						draggable={false}
						onClick={(e) => e.stopPropagation()}
						onPointerDown={(e) => e.stopPropagation()}
						className="text-muted-foreground hover:text-signal-ink relative mt-px shrink-0 transition-colors after:absolute after:-inset-2.5 after:content-['']"
						aria-label="Open posting in a new tab"
						title="Go to website"
					>
						<ExternalLink className="size-3.5" />
					</a>
				)}
			</div>

			<p className="truncate text-meta leading-[1.4]">
				<span className="text-ink-2 font-medium tracking-[-0.005em]">
					{job.company || "(no company)"}
				</span>
				{mode && !archive && (
					<span className="text-muted-foreground">
						{" · "}
						{mode}
					</span>
				)}
			</p>

			{/* `text-data` on the row, not just its children: a flex row with no
			    font-size inherits root 16px/24px and reserves 24px for 10.5px. */}
			<div className="text-data mt-1 flex items-center gap-1.5 leading-[1.4] whitespace-nowrap">
				{idLabel && (
					<span
						className="text-muted-foreground shrink-0 font-data text-data tabular-nums"
						// Native tooltip, not the Tooltip component: no extra listeners per card.
						title={
							duplicateOf
								? `Duplicate of #${duplicateOf.canonical.id ?? "?"} - ${duplicateOf.canonical.company ?? "?"}`
								: undefined
						}
					>
						{/* The id is the handle shared with the JSON and CLI skills, so it is
						    read aloud. Hidden span, not `aria-label`: a bare `<span>` exposes
						    no accessible name and the label would be dropped. */}
						<span aria-hidden="true">{idLabel}</span>
						<span className="sr-only">
							{duplicateOf
								? `Entry ${idLabel}, a duplicate of #${duplicateOf.canonical.id ?? "?"}`
								: `Entry ${idLabel}`}
						</span>
					</span>
				)}
				{!archive && <span aria-hidden className="lamp size-1.5 shrink-0" />}
				{/* /scrape's pre-check, shown only until /rank has scored the entry. */}
				{!archive && !scored && job.fit && (
					<span
						className={cn(
							"font-stretch-[86%] text-data font-semibold tracking-[0.07em] uppercase",
							FIT_INK[fit] ?? FIT_INK.low,
						)}
					>
						{job.fit}
					</span>
				)}

				{!archive && scored && (
					<span className="text-foreground rounded-chip border border-border bg-background px-1.5 py-px font-data text-data font-semibold tabular-nums">
						{score}
					</span>
				)}

				{copyCount > 0 && (
					<span className="text-muted-foreground rounded-chip border border-border bg-background px-1 py-px font-data text-data font-medium tabular-nums">
						<span aria-hidden="true">×{copyCount + 1}</span>
						<span className="sr-only">
							{`${copyCount} duplicate${copyCount === 1 ? "" : "s"} hidden behind this card`}
						</span>
					</span>
				)}

				{/* Deadline while triaging, wait once applied, nothing otherwise:
				    first-seen is bookkeeping, not a reason to act. */}
				{!archive && due ? (
					<span
						className={cn(
							"ml-auto shrink-0 font-data text-data tabular-nums",
							DEADLINE_INK[due.state],
							due.state === "soon" && "font-semibold",
						)}
					>
						{due.text}
					</span>
				) : !archive && age ? (
					// Bare days: the column names the stage, and spelling it out here read
					// as an event ("interview today") rather than a wait.
					<span
						className={cn(
							"ml-auto shrink-0 font-data text-data tabular-nums",
							age.stale
								? "text-[var(--lamp-mid-ink)] font-semibold"
								: "text-muted-foreground",
						)}
						title={
							showTotal
								? `${age.days}d in this stage · ${total.days}d since applied`
								: age.days === 0
									? "Entered this stage today"
									: `${age.days}d in this stage`
						}
					>
						<span aria-hidden="true">
							{age.text}
							{showTotal && (
								<span className="text-muted-foreground font-normal">
									{" · "}
									{total.text}
								</span>
							)}
						</span>
						<span className="sr-only">
							{showTotal
								? `${age.days} days in this stage, ${total.days} days since applied`
								: age.days === 0
									? "entered this stage today"
									: `${age.days} days in this stage`}
						</span>
					</span>
				) : null}
			</div>

			{/* Verbatim except the truncated period ("90-110PLN/ho" -> "/h"). */}
			{job.salary && !archive && (
				<p className="truncate font-data text-data font-medium text-[color-mix(in_oklab,var(--foreground)_82%,var(--muted-foreground))]">
					{readableSalary(job.salary)}
				</p>
			)}

			{/* Why it ended, when that is more than "they said no". The status only
			    says it is over. */}
			{outcomes.length > 0 && (
				<p className="mt-0.5 flex flex-wrap items-center gap-1">
					{outcomes.map((tag) => (
						<span
							key={tag.id}
							className="text-muted-foreground rounded-chip border border-border bg-background px-1 py-px font-stretch-[88%] text-data font-semibold tracking-[0.03em] uppercase inline-flex items-center gap-0.5"
						>
							{/* Silence has its own glyph, in the ending's own red - same rule
							    the timeline follows. See history-page.tsx. */}
							{tag.id === "ghosted" && (
								<Ghost aria-hidden className="size-3 text-destructive" />
							)}
							{tag.short}
						</span>
					))}
				</p>
			)}

			{/* Archive prefers `notes` over `excluded_reason`: on a skipped card the
			    hand-typed note is the reason it is there. */}
			{!archive && job.notes && (
				<p className="text-muted-foreground line-clamp-1 text-meta leading-[1.4] italic">
					{job.notes
						.replace(/—/g, "-")
						.replace(/\s+/g, " ")
						.trim()
						.replace(/^./, (c) => c.toUpperCase())}
				</p>
			)}
			{archive && (job.notes || job.excluded_reason) && (
				<p
					className={cn(
						"text-muted-foreground line-clamp-1 text-meta leading-[1.4]",
						job.notes && "italic",
					)}
				>
					{(job.notes || job.excluded_reason || "")
						.replace(/—/g, "-")
						.replace(/\s+/g, " ")
						.trim()
						.replace(/^./, (c) => c.toUpperCase())}
				</p>
			)}
		</>
	);
}
