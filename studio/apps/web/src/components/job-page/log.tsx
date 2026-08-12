import { X } from "lucide-react";
import { useMemo } from "react";
import {
	AddLine,
	EditableDate,
	EditableText,
} from "@/components/job-page/editable";
import { SCROLL } from "@/components/job-page/track";
import { Chip, StripHead } from "@/components/strip";
import {
	appendEntry,
	buildJourney,
	dropEntry,
	type EventKind,
	type Job,
	type JobChanges,
	type JourneyEvent,
	redateEntry,
	rewriteEntry,
	rewriteProse,
	todayISO,
} from "@/lib/jobs";
import { EVENT, type Hue, run } from "@/lib/strip";
import { cn } from "@/lib/utils";

/**
 * What has happened to this one application, newest first.
 *
 * THE NOTE IS THE JOURNAL. Nothing in the file logs events, so the running record went
 * into `notes` by hand, as `3 Jul: Screening` lines. This reads them back out and mixes
 * them with the dates the entry already carries, so the hand-written story and the
 * recorded stages are one sequence instead of two. Every write rewrites a single line
 * of `notes` and leaves the rest byte for byte: the field stays the source of truth,
 * `/rank` and `/apply` keep reading what they always read, and the diff is one line.
 *
 * TODAY IS A LINE ACROSS IT. A booked interview is dated ahead, and printing it in
 * sequence with things that already happened is how a plan reads as a record. What is
 * coming sits above the rule, in the order it will arrive; what happened sits below it,
 * newest first. Both read outward from where the reader is standing.
 *
 * THE WAIT IS THE FINDING. Each line carries the days since the one under it. A
 * three-week gap in a live process is the reason to open this page at all, so it is
 * printed rather than left to be worked out from two dates.
 *
 * THE SPINE IS THE RAIL, VERTICAL. Every length of line between two medallions carries
 * the hue of the event above it into the hue of the one below, so the log walks the same
 * colours as the chevron rail over it and the two readings of one set of dates are one
 * colour language. See `log-spine` in index.css.
 */

/** The entry's own field behind each derived line, where the board may rewrite it. */
/**
 * The entry's own field behind each derived line, where the board may rewrite it. Keyed by
 * kind rather than by the row's id, because a hand-added entry's sighting reads as `added`
 * while still living in `first_seen`. `ranked` is absent on purpose: that stamp is
 * `/rank`'s own, and a score nobody can reproduce by hand is not a date to correct.
 */
const FIELD: Partial<Record<EventKind, keyof JobChanges>> = {
	found: "first_seen",
	added: "first_seen",
	applied: "applied_date",
	screening: "screening_date",
	tech_interview: "tech_interview_date",
	final_round: "final_round_date",
	offer: "offer_date",
	closed: "rejected_date",
};

/**
 * Date, then the words, then the wait. The chip keeps a fixed width inside the middle
 * cell rather than owning a column of its own, so the words still start down one edge on
 * a wide track and drop under the chip when the track is too narrow to hold both - which
 * is a phone, where a fixed chip column left one word per line.
 */
const ROW = "grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-start gap-x-2.5";

/** The hue of the line below, or none at the end of a list, where the spine runs flat. */
const hueOf = (event?: JourneyEvent): Hue | undefined =>
	event && (EVENT[event.kind].hue as Hue);

function Row({
	event,
	next,
	job,
	onNotes,
	onPatch,
}: {
	event: JourneyEvent;
	/** The hue of the line under this one, which its length of spine ramps out of. */
	next?: Hue;
	job: Job;
	onNotes: (notes: string) => void;
	onPatch: (changes: JobChanges) => void;
}) {
	const { icon: Icon, hue } = EVENT[event.kind];
	const note = event.kind === "note" && event.line !== undefined;
	const field = FIELD[event.kind];
	const notes = job.notes ?? "";

	return (
		<li className="group/row relative pl-9" style={run(hue as Hue, next)}>
			{/* The spine, drawn per row rather than once down the list: each length of it
			    is the passage between the two events it joins, so it carries the hue of
			    this line into the hue of the one below - the rail's walk, vertical. It
			    runs past the bottom of the row to bridge the 4px gap, and the first and
			    last in a list tuck under their own medallion the way the single spine
			    this replaced did. */}
			<span
				aria-hidden
				className="log-spine absolute top-0 -bottom-1 left-[12.5px] w-px [li:first-child>&]:top-2 [li:last-child>&]:bottom-2"
			/>

			{/* The medallion sits on the spine, off the line - the one thing here that
			    reads as hardware rather than as text. Pinned to the first line, because
			    a log entry can run to three. */}
			<span
				aria-hidden
				className="bg-card border border-border absolute top-1 left-0 grid size-[26px] place-items-center rounded-full"
			>
				<Icon className="size-3.5 text-[var(--evt)]" />
			</span>

			<div
				className={cn(
					ROW,
					"bg-card border border-border rounded-key py-1.5 pr-2 pl-2.5 transition-colors duration-150 ease-out hover:border-border-strong",
				)}
			>
				{/* The date is where it gets corrected, for every line that has a field
				    behind it. `rank_date` has none: that is /rank's own stamp. */}
				{note && event.line !== undefined ? (
					<EditableDate
						label={`${event.tag} date`}
						value={event.date}
						look="line"
						hue
						onSave={(iso) =>
							iso && onNotes(redateEntry(notes, event.line as number, iso))
						}
					/>
				) : field ? (
					<EditableDate
						label={`${event.tag} date`}
						value={event.date}
						look="line"
						hue
						onSave={(iso) => onPatch({ [field]: iso } as JobChanges)}
					/>
				) : (
					<span className="text-muted-foreground font-data text-data tabular-nums">
						{event.date.slice(5)}
					</span>
				)}

				<span className="flex min-w-0 flex-wrap items-start gap-x-2.5 gap-y-1">
					<Chip className="w-[5.25rem] shrink-0">{event.tag}</Chip>

					{/* A derived row's chip already names the stage, so there is nothing to
					    write beside it: "FINAL ROUND · final round reached" was the same fact
					    twice. Only rows with something to say carry words. */}
					{note && event.line !== undefined ? (
						<EditableText
							label="log entry"
							value={event.text}
							look="line"
							multiline
							className="min-w-[10rem] flex-1"
							onSave={(text) =>
								onNotes(
									text
										? rewriteEntry(notes, event.line as number, text)
										: dropEntry(notes, event.line as number),
								)
							}
						/>
					) : event.text ? (
						<span className="text-ink-2 min-w-[10rem] flex-1 text-body text-pretty">
							{event.text}
						</span>
					) : null}
				</span>

				<span className="flex items-center gap-1 pt-px">
					{event.ahead !== undefined ? (
						<span className="font-data text-data font-semibold tabular-nums text-[var(--evt)]">
							in {event.ahead}d
						</span>
					) : event.gap ? (
						<span
							className="text-muted-foreground font-data text-data tabular-nums"
							title={`${event.gap} days after the line below`}
						>
							<span aria-hidden="true">+{event.gap}d</span>
							<span className="sr-only">
								{event.gap} days after the previous entry
							</span>
						</span>
					) : null}
					{/* Only a hand-written line can be dropped: the rest are the entry's
					    own dates, and clearing one is what the date control is for. */}
					{note && event.line !== undefined && (
						<button
							type="button"
							onClick={() => onNotes(dropEntry(notes, event.line as number))}
							aria-label="Delete this log entry"
							className="text-muted-foreground hover:text-destructive rounded-[3px] opacity-0 transition-opacity duration-150 ease-out group-hover/row:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal"
						>
							<X className="size-3" />
						</button>
					)}
				</span>
			</div>
		</li>
	);
}

export function JourneyLog({
	job,
	onNotes,
	onPatch,
}: {
	job: Job;
	/** The whole `notes` field, rewritten. Autosaves like the popover's textarea. */
	onNotes: (notes: string) => void;
	onPatch: (changes: JobChanges) => void;
}) {
	const { upcoming, past, log } = useMemo(() => buildJourney(job), [job]);
	const empty = upcoming.length === 0 && past.length === 0;

	return (
		<section
			aria-label="Log"
			className="group/edits flex min-h-0 flex-col gap-3"
		>
			<div className="flex flex-col gap-2">
				{/* No colour swatches on this heading. On the search timeline they say
				    what a day was made of before it is read; here every row is already
				    below with its own chip, so six dots next to a count key nothing. */}
				<StripHead
					label="Log"
					note={`${past.length + upcoming.length} dated`}
				/>

				{/* Whatever in the note is not a dated line: the recruiter's name, the rate
				    discussed, why you passed. Standing context, so it sits above the run
				    rather than in it. */}
				<EditableText
					label="Note"
					value={log.prose || undefined}
					placeholder="Recruiter name, rate discussed, what to ask…"
					look="line"
					multiline
					className="text-muted-foreground"
					// The dated lines stay where they were and only the prose is rewritten,
					// so editing the standing note cannot eat the log or reorder it.
					onSave={(text) => onNotes(rewriteProse(job.notes, log.entries, text))}
				/>

				<AddLine
					placeholder="What happened today…"
					onAdd={(text) =>
						onNotes(appendEntry(job.notes, todayISO(), text, log.style))
					}
				/>
			</div>

			<div className={SCROLL}>
				{empty ? (
					<p className="label text-muted-foreground py-10 text-center text-legend">
						nothing dated on this entry yet
					</p>
				) : (
					<>
						{upcoming.length > 0 && (
							<ul className="relative mb-1 flex flex-col gap-1">
								{upcoming.map((event, i) => (
									<Row
										key={event.id}
										event={event}
										next={hueOf(upcoming[i + 1])}
										job={job}
										onNotes={onNotes}
										onPatch={onPatch}
									/>
								))}
							</ul>
						)}

						{/* Where the reader is standing. Only drawn when there is something
						    above it: a rule with nothing over it is a rule under a heading. */}
						{upcoming.length > 0 && past.length > 0 && (
							<div className="my-2 flex items-center gap-2 pl-9">
								{/* "now", not "today": as a heading over a run of dated lines,
								    "today" reads as the date they carry. */}
								<span className="legend text-muted-foreground shrink-0 text-legend">
									now
								</span>
								<span aria-hidden className="rule min-w-0 flex-1" />
							</div>
						)}

						{past.length > 0 && (
							<ul className="relative flex flex-col gap-1">
								{past.map((event, i) => (
									<Row
										key={event.id}
										event={event}
										next={hueOf(past[i + 1])}
										job={job}
										onNotes={onNotes}
										onPatch={onPatch}
									/>
								))}
							</ul>
						)}
					</>
				)}
			</div>
		</section>
	);
}
