import { type ReactNode, useEffect, useRef } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	buildStages,
	columnOf,
	daysBetween,
	daysElapsed,
	type Job,
	outcomeTags,
	processAge,
	processSince,
	type StageStep,
	type Status,
	shortDate,
	stageAge,
	stageSince,
} from "@/lib/jobs";
import { CHIP_LABEL, EVENT, STATUS_HUE, tint } from "@/lib/strip";
import { cn } from "@/lib/utils";

/**
 * Where this application stands, as the pipeline itself.
 *
 * THE RAIL IS THE READING AND THE CONTROL. Eight chevrons - the seven pipeline stages,
 * plus the ending slotted in before Offer - each in the colour that stage is everywhere
 * else in this app, and clicking one moves the entry there through the same
 * `changeStatus` a drag runs, so the stage prompt still asks for the day and Rejected
 * still asks how it ended. Nothing new writes here.
 *
 * FLAT, NOT A RAMP. The chevrons were tried filling from the stage before them into their
 * own, so the run read as one gradient walk. Eight hues blended end to end is a spectrum,
 * and a spectrum is a decoration: the stage a chevron names stopped being the colour that
 * stage is everywhere else in the app, which is the whole of what the colour is for. The
 * passage between two stages is drawn where it is an event - the toast, the card that just
 * landed - not where it is a standing reading.
 *
 * EXACTLY ONE IS LIT. Rejected and Offer are the only two ways out and they cannot both
 * be true, so they sit side by side at the end of the run. On a dead entry the stage it
 * reached keeps its colour and its date but stops reading as a position - the ending is
 * where it stands.
 *
 * THE RUN IS ONE OBJECT. The chevrons interlock - each point seated in the next
 * one's notch - so the pipeline reads as a single rail rather than seven plates
 * adrift on the plate. They were separated by a 36px joint that carried the days
 * between two dates and, on the four entries out of five with nothing to measure, a
 * dot in the middle of an inch of nothing.
 *
 * TIME RIDES WITH THE DATE IT MEASURES TO. `+3d` sits beside the date under its own
 * stage, which is the one question a tracker cannot answer by looking at a board:
 * not where it is, but how long each step took. Nothing to measure prints nothing,
 * and the empty slot is still the thing worth filling in.
 *
 * A stage still ahead of today is a booking, not a wait, and reads `in 1d`. The rail
 * reads dates; the log beside it is where one gets corrected.
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** A stored value only if it is a date. The file is hand-edited; a stray string is not. */
const iso = (value: unknown): string | undefined =>
	typeof value === "string" && ISO.test(value) ? value : undefined;

/** The chevron, drawn twice: the outer element is the hairline, the inner the fill. */
const SHAPE = (first: boolean, last: boolean) =>
	first ? "chevron-head" : last ? "chevron-tail" : "chevron";

/**
 * The glyph each chevron carries. Total rather than a partial with a fallback to the
 * status's own name: three of the nine are not filed under it, and a fallback that only
 * type-checks for the other six is a fallback that does not type-check.
 */
const GLYPH: Record<StageStep["status"], keyof typeof EVENT> = {
	new: "found",
	ranked: "ranked",
	applied: "applied",
	screening: "screening",
	tech_interview: "tech_interview",
	final_round: "final_round",
	offer: "offer",
	rejected: "closed",
	skipped: "closed",
};

function Segment({
	step,
	first,
	last,
	closed,
	onStatus,
}: {
	step: StageStep;
	first: boolean;
	last: boolean;
	/** The entry is over, so the stage it stopped at is a record, not a position. */
	closed: boolean;
	onStatus: (status: Status) => void;
}) {
	const { icon: Icon } = EVENT[GLYPH[step.status]];
	const shape = SHAPE(first, last);
	/**
	 * Where the entry stands. On a closed one that is the ending chevron and nothing
	 * else: the stage it got to is a record, so it keeps its colour and its date but
	 * stops claiming to be a position - including to a screen reader, which would
	 * otherwise be told two steps are current.
	 */
	const here = step.current && !closed;

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<button
						type="button"
						onClick={() => onStatus(step.status)}
						aria-current={here ? "step" : undefined}
						// The name has to be the action. Left to its text content it read
						// "Screening, dash", which names neither the control nor what pressing
						// it does; the tooltip is a description and cannot stand in for it.
						aria-label={
							here
								? `${step.label}, where this entry stands`
								: `Move to ${step.label}`
						}
						// The hairline plane. Transparent mixes composite against the page,
						// which is what keeps an unreached chevron reading as an empty slot.
						// No outline: a `clip-path` clips it, and a 2px offset ring falls
						// entirely outside the chevron. The hairline plane is already a
						// perimeter that follows the shape exactly, so focus thickens it and
						// takes the accent - the same crisp accent edge the inputs get.
						className={cn(
							shape,
							"group/step relative block min-w-0 flex-1 text-left outline-none transition-[background-color,padding] duration-150 ease-out",
							"focus-visible:bg-signal focus-visible:p-[2px]",
							step.reached
								? here
									? "p-px bg-[color-mix(in_oklab,var(--evt)_55%,transparent)]"
									: "p-px bg-[color-mix(in_oklab,var(--evt)_26%,transparent)]"
								: // The stronger hairline on the empty slots, which is the only
									// thing dividing one from the next: at `border` weight five
									// unreached chevrons in a row welded into a single dark band
									// and the notches stopped reading as notches.
									"p-px bg-border-strong",
						)}
					/>
				}
			>
				<span
					className={cn(
						shape,
						"flex h-full w-full flex-col justify-center gap-px py-2 pr-4",
						first ? "pl-3.5" : "pl-6",
						"transition-[background-color] duration-150 ease-out",
						step.reached
							? here
								? "bg-[color-mix(in_oklab,var(--evt)_20%,var(--card))]"
								: "bg-[color-mix(in_oklab,var(--evt)_12%,var(--card))]"
							: "bg-card group-hover/step:bg-card-hover",
					)}
				>
					<span className="flex items-center gap-1.5">
						{/* Only where the entry stands: a glyph on all seven would be seven
						    glyphs, and the one that matters is where you are. */}
						{here && (
							<Icon
								aria-hidden
								className="size-3.5 shrink-0 text-[var(--evt)]"
							/>
						)}
						{/* The chip's own labels: "Tech interview" is the one stage name wider
						    than the slot it has to fit, and a truncated label has stopped
						    being one. */}
						<span
							className={cn(
								"label truncate text-legend",
								step.reached
									? here
										? "text-[var(--evt)] font-semibold"
										: "text-[var(--evt)]"
									: "text-muted-foreground",
							)}
						>
							{CHIP_LABEL[step.status]}
						</span>
					</span>
					<span className="flex min-w-0 items-baseline gap-1.5 font-data text-data tabular-nums">
						<span
							className={cn(
								"truncate",
								step.ahead !== null
									? "text-[var(--evt)] font-semibold"
									: "text-muted-foreground",
							)}
						>
							{step.ahead !== null ? (
								<>in {step.ahead}d</>
							) : step.date ? (
								shortDate(step.date)
							) : (
								<span className={step.reached ? "" : "opacity-0"}>
									<span aria-hidden="true">-</span>
								</span>
							)}
						</span>
						<Leg step={step} />
					</span>
				</span>
			</TooltipTrigger>
			{/* The leg's sentence rides here now that it has no joint of its own: which two
			    dated stages the `+3d` actually spans, which is not always this chevron and
			    the one to its left. */}
			<TooltipContent side="bottom">
				{[
					here
						? step.date
							? `Reached ${step.date}`
							: "Where this entry stands"
						: `Move to ${step.label}`,
					legend(step),
				]
					.filter(Boolean)
					.join(" · ")}
			</TooltipContent>
		</Tooltip>
	);
}

/**
 * How long the step into this stage took, beside the date it took to.
 *
 * A negative count means the file's own dates disagree with the pipeline - one entry
 * has a screening dated before the application - so it reads as a bare `-2d` in the
 * warning ink rather than as `+-2d`. That is a thing to go and fix, and the date it
 * sits next to is where it gets fixed.
 *
 * The count runs back to the last stage that has a date, which is not always the
 * chevron to its left, so the chevron's tooltip says which two ends it spans.
 */
function Leg({ step }: { step: StageStep }) {
	// Nought is the one count that says nothing: the two dates it spans are the same
	// date, and both are already printed on the rail. Every other leg is arithmetic
	// nobody should have to do.
	if (!step.days) return null;
	const backwards = step.days < 0;
	return (
		<span
			className={cn(
				"shrink-0",
				backwards
					? "text-[var(--lamp-mid-ink)] font-semibold"
					: "text-[var(--evt)]",
			)}
		>
			<span aria-hidden="true">
				{backwards ? "" : "+"}
				{step.days}d
			</span>
			<span className="sr-only">{legend(step)}</span>
		</span>
	);
}

/** The leg as a sentence, for the tooltip and for a screen reader. */
const legend = (step: StageStep): string =>
	step.days === null
		? ""
		: step.days < 0
			? `${step.label} is dated ${-step.days} days before ${step.from ?? "the stage before it"}`
			: `${step.days} days from ${step.from ?? "the stage before"} to ${step.label}`;

export function StageRail({
	job,
	onStatus,
}: {
	job: Job;
	onStatus: (status: Status) => void;
}) {
	const current = columnOf(job);
	const closed = current === "rejected" || current === "skipped";
	const stages = buildStages(job);
	const since = stageSince(job);
	const age = !closed && since ? stageAge(since, current) : null;
	const total = closed ? null : processAge(job);
	const showTotal = total && (!age || total.days !== age.days);
	const tags = current === "rejected" ? outcomeTags(job) : [];
	const stopped = stages.find((step) => step.current);
	const stage = stopped?.label.toLowerCase() ?? "this stage";
	// Days until the stage it is in actually happens, when that is still ahead.
	const booked = closed ? null : (stopped?.ahead ?? null);
	/**
	 * How long this has been in play at all, which is the first thing the page is
	 * opened for. Off the earliest date the entry carries rather than `applied_date`:
	 * 51 of 392 entries have one, and an application logged without a date read as
	 * having taken no time.
	 */
	const start = processSince(job);
	/**
	 * A closed application ran from its first date to the day it closed. Measured to
	 * today instead, the total on a dead entry kept growing every morning - "72d in
	 * total" on a process that took thirty.
	 */
	const ended = closed
		? (iso(job.rejected_date) ?? iso(job.status_date) ?? undefined)
		: undefined;
	const running = start
		? closed
			? ended
				? daysBetween(start, ended)
				: null
			: daysElapsed(start)
		: null;

	/**
	 * THE EIGHTH CHEVRON: the end that is not an offer, in the run rather than beside it.
	 *
	 * It sits before Offer because those two are the only ways out and exactly one of
	 * them can be true, so the eye should find them in one place at the end of the rail.
	 * It was a Close button parked outside the run, which said what to do but never where
	 * a dead entry stood - the rail's own answer to that was to leave the stage it died
	 * at lit, as though it were still in play.
	 *
	 * The pipeline steps keep their `current` for the caption's "stopped at screening",
	 * and `closed` tells them to stop rendering it as a position - which is what leaves
	 * this the only chevron lit on a dead entry.
	 */
	const last = [...stages].reverse().find((step) => step.date);
	const ending: StageStep = {
		status: closed ? current : "rejected",
		label: closed ? CHIP_LABEL[current] : "Rejected",
		date: ended,
		reached: closed,
		current: closed,
		days: closed && ended && last?.date ? daysBetween(last.date, ended) : null,
		from: last?.label,
		ahead: null,
	};
	const chevrons = [...stages.slice(0, -1), ending, stages[stages.length - 1]];

	/**
	 * What the rail cannot state by itself: totals, and a wait that has gone on too
	 * long. A clause is here only when it has a number worth reading - `running &&`
	 * and `age?.days` both fall through on nought, which is the whole of the day-zero
	 * noise this line used to carry.
	 */
	const line: ReactNode[] = [];
	/** Clauses, middot-separated the way every other joined reading on this page is. */
	const say = (part: ReactNode) => {
		if (line.length)
			line.push(
				<span
					key={`gap${line.length}`}
					aria-hidden
					className="text-muted-foreground/45"
				>
					·
				</span>,
			);
		line.push(part);
	};
	if (closed) {
		say(
			<span key="closed">
				{running !== null && `${running}d in total · `}
				stopped at {stopped?.label.toLowerCase() ?? "intake"}
			</span>,
		);
		/* How it ended, which the chip beside the rail used to carry. The chevron
		   states the day and the word; these are the ways, and they combine. */
		if (tags.length > 0)
			say(
				<span
					key="tags"
					style={tint(STATUS_HUE[current])}
					className="text-[var(--evt)]"
				>
					{tags.map((tag) => tag.short).join(" · ")}
				</span>,
			);
	} else {
		if (running)
			say(
				<span key="process" className="text-ink-2 font-medium">
					{running}d in process
				</span>,
			);
		if (showTotal && total?.days)
			say(<span key="applied">applied {total.text} ago</span>);
		/* A stage dated ahead of today is booked, and every reading in `dates.ts`
		   returns null for one - so without this the line on the entry that has an
		   interview tomorrow is the only one that cannot say the thing worth knowing. */
		if (booked !== null)
			say(
				<span
					key="booked"
					className="text-[var(--evt)] font-semibold"
					style={tint(STATUS_HUE[stopped?.status ?? "new"])}
				>
					{stage} in {booked}d
				</span>,
			);
		else if (age?.days)
			say(
				<span
					key="age"
					className={cn(
						age.stale && "text-[var(--lamp-mid-ink)] font-semibold",
					)}
				>
					{age.text} in {stage}
					{age.stale && " · worth a chase"}
				</span>,
			);
	}

	/**
	 * Where it stands, brought into view on the widths where the run has to slide. A
	 * phone opening this on New with the current stage two screens to the right is the
	 * rail failing at the one thing it is for.
	 *
	 * Found by its own `aria-current`, not by a ref: the chevron is a tooltip trigger and
	 * the ref threaded through that render prop never arrived, so the scroll silently
	 * never happened. The attribute that states where the entry stands is the thing to
	 * look for anyway.
	 */
	const track = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const scroller = track.current;
		if (!scroller) return;

		/**
		 * Which edge still has run behind it, as a data attribute: the fade that says so
		 * is CSS, and a re-render per scroll frame would be a re-render for nothing.
		 *
		 * Read off the position rather than off "does it overflow". A fade on an edge with
		 * nothing past it is an affordance that lies, and at either end of the run one of
		 * the two always would.
		 */
		const edges = () => {
			const room = scroller.scrollWidth - scroller.clientWidth;
			if (room <= 1) {
				scroller.dataset.slides = "";
				return;
			}
			const left = scroller.scrollLeft > 1;
			const right = scroller.scrollLeft < room - 1;
			scroller.dataset.slides = left && right ? "both" : left ? "start" : "end";
		};
		edges();
		scroller.addEventListener("scroll", edges, { passive: true });
		const done = () => scroller.removeEventListener("scroll", edges);

		const target = scroller.querySelector<HTMLElement>('[aria-current="step"]');
		if (!target || scroller.scrollWidth <= scroller.clientWidth) return done;
		const reduced = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		// `scrollIntoView`, not arithmetic on `offsetLeft`: the chevron's offset parent is
		// the page, not the scroller, so the sum was a page coordinate handed to a
		// scroller. The same call the board already uses to bring a column into view.
		// `nearest`, not `center`: it scrolls the least it can, and does nothing at all
		// when the stage is already on screen. Centring meant a run one chevron too wide
		// for its track opened with its first stage cut off the left edge.
		target.scrollIntoView({
			behavior: reduced ? "auto" : "smooth",
			inline: "nearest",
			block: "nearest",
		});
		return done;
	}, []);

	return (
		<section aria-label="Stage" className="flex flex-col gap-2">
			<div className="flex items-stretch">
				<h2 className="sr-only">Stage</h2>
				{/* Eight labels have a floor, and the floor is the longest label plus the
				    current stage's glyph - "Final round" truncated on exactly the chevron
				    that matters. Below it the run keeps its size and slides, with the
				    current stage scrolled into view; a chevron squeezed to twenty pixels is
				    a colour, not a stage. Interlocking bought back the 13.5rem the joints
				    were holding, which is what paid for the ending moving in here. */}
				<div ref={track} className="min-w-0 flex-1 overflow-x-auto">
					<div className="flex min-w-[70rem] items-stretch">
						{chevrons.map((step, i) => (
							/**
							 * The page's one authored moment: the run assembles left to right,
							 * in the direction the pipeline goes, so the first thing that
							 * happens on screen is the shape of the thing being read. A
							 * stagger is right here for the reason it was wrong on the search
							 * timeline - this is one object arriving along its own axis, not
							 * rows painting a frontier down a page.
							 */
							<div
								key={step.status}
								/* Seated, not spaced. The overlap is 2px short of the 0.5rem the
								   `chevron` clip-path cuts out of the next one's left edge, so
								   the point sits inside the notch with a 2px rake of the page
								   showing along the diagonal. Mated exactly, the run welded into
								   one dark band and the notches stopped reading; the dark gap
								   separates the plates the way the 36px joints did, at 2px. */
								className={cn(
									"flex min-w-0 flex-1 items-stretch duration-300 ease-out animate-in fade-in-0 slide-in-from-left-2 motion-reduce:animate-none",
									i > 0 && "-ml-1.5",
								)}
								style={{
									...tint(STATUS_HUE[step.status]),
									animationDelay: `${i * 40}ms`,
								}}
							>
								<Segment
									step={step}
									first={i === 0}
									last={i === chevrons.length - 1}
									// The ending is the one chevron a closed entry is standing
									// on, so it is the one the rule does not apply to.
									closed={closed && step !== ending}
									onStatus={onStatus}
								/>
							</div>
						))}
					</div>
				</div>
			</div>

			{/* One line under the run - how long in total, how long here, whether the wait
			    has become the story - and nothing at all on the day everything happened.
			    Every zero-day reading it used to print ("found today · entered applied
			    today", under a rail of chevrons all dated today) was the page restating
			    what the chevron above it had just said, in worse words. Same for "not
			    applied yet" beside an Applied chevron standing empty. */}
			{line.length > 0 && (
				<p className="text-muted-foreground flex items-baseline gap-2 pl-3.5 font-data text-data tabular-nums">
					{line}
				</p>
			)}
		</section>
	);
}
