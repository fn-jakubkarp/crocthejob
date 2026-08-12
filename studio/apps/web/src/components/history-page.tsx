import { Ghost } from "lucide-react";
import { useMemo } from "react";
import { Chip, StripHead } from "@/components/strip";
import {
	buildHistory,
	type DupIndex,
	type HistoryEvent,
	type Job,
	type Status,
} from "@/lib/jobs";
import { EVENT, type Hue, LINE, LINE_HOVER, tint } from "@/lib/strip";

/**
 * What has been happening, newest first.
 *
 * THESIS. The board says where every posting stands and the stats page says what the
 * totals come to; neither says what was *done*, or when it stopped being done. This is
 * the record of the actions: scrape runs, ranking passes, applications out, stages
 * reached, applications closed. A three-week gap is as much a reading as a busy day,
 * so the days are the structure and an empty stretch shows as the jump between two
 * dates rather than being smoothed away.
 *
 * COLOUR IS THE INDEX. A timeline is scanned, not read: what a day was should be a
 * shape in colour before it is a sentence. So every line opens with a filled chip in
 * the colour of its kind, and the medallion on the spine repeats it. The chip carries
 * the word too, so nothing here rests on colour alone. The eight hues are fixed in
 * `index.css` and mean one thing each: green is the win, red is an ending, the
 * application lane walks blue to magenta as it advances, and the machine's own work
 * stays off that lane in steel and amber.
 *
 * ONE LINE PER ACTION. A scrape that swept five portals and wrote 259 rows is one line
 * with 259 on it; the portals are the detail. Only a posting moving on its own -
 * applied, a stage reached, an ending - earns a line. `buildHistory` holds that rule,
 * and the row is one line high so a day is read as a block rather than a list.
 */

type Props = {
	jobs: Job[];
	dupes: DupIndex;
	/** Opens the column a line's posting sits in now. */
	onOpen: (status: Status) => void;
};

/**
 * ONE PLATE, ONE MOVE. The page seats as a single object: everything on it fades up and
 * rises the same 8px at the same moment, so nothing arrives before its neighbour.
 *
 * It was a stagger down the rows, and a stagger down a timeline paints a frontier between
 * the rows that have arrived and the empty ground below them. On this page - dark tiles on
 * a darker panel, with a hairline spine already drawn behind them - that frontier reads as
 * a black band running down the screen, which is the one thing this entrance must not do.
 * Any per-row or per-day delay brings it straight back.
 */
const ENTER =
	"duration-400 ease-out animate-in fade-in-0 slide-in-from-bottom-2";

/** One line high, and the chip column fixed so every line reads down one edge. */
const ROW = "grid-cols-[5.75rem_minmax(0,1fr)]";

function Row({
	event,
	onOpen,
}: {
	event: HistoryEvent;
	onOpen: (status: Status) => void;
}) {
	const { icon: Icon, hue } = EVENT[event.kind];
	const status = event.status;

	const body = (
		<>
			<Chip>{event.tag}</Chip>
			<span className="flex min-w-0 items-baseline gap-x-2">
				{event.lead && (
					<span className="text-ink-2 shrink-0 text-body font-medium">
						{event.lead}
					</span>
				)}
				{event.object && (
					<span className="text-muted-foreground min-w-0 truncate text-meta">
						{event.object}
					</span>
				)}
				{event.detail && (
					<span className="text-muted-foreground ml-auto flex shrink-0 items-center gap-1 truncate pl-2 font-data text-data">
						{/* Silence has its own glyph, in the ending's own red: the commonest
						    way an application dies should be seen, not read. */}
						{event.mark === "ghost" && (
							<Ghost aria-hidden className="size-3.5 text-[var(--evt)]" />
						)}
						{event.detail}
					</span>
				)}
			</span>
		</>
	);

	return (
		<li className="relative pl-9" style={tint(hue)}>
			{/* The medallion sits on the spine, off the tile - the one thing on the page
			    that reads as hardware rather than as text. */}
			<span
				aria-hidden
				className="bg-card border border-border absolute top-1/2 left-0 grid size-[26px] -translate-y-1/2 place-items-center rounded-full"
			>
				<Icon className="size-3.5 text-[var(--evt)]" />
			</span>

			{status ? (
				<button
					type="button"
					onClick={() => onOpen(status)}
					className={`${LINE} ${ROW} ${LINE_HOVER}`}
				>
					{body}
					<span className="sr-only">Open the column it sits in now</span>
				</button>
			) : (
				<div className={`${LINE} ${ROW}`}>{body}</div>
			)}
		</li>
	);
}

export function HistoryPage({ jobs, dupes, onOpen }: Props) {
	// Postings, never entries - the same population the stats page counts, so a scrape
	// that found the same posting twice does not print as two.
	const days = useMemo(
		() => buildHistory(jobs.filter((job) => !dupes.of.has(job.key))),
		[jobs, dupes],
	);

	return (
		<main className="min-h-0 flex-1 overflow-y-auto p-3 pl-[4.5rem]">
			<div
				className={`mx-auto flex w-full max-w-2xl flex-col gap-6 py-6 ${ENTER}`}
			>
				<header className="flex flex-col gap-1.5">
					<span className="legend text-muted-foreground text-legend">
						Search activity
					</span>
					<h1 className="text-ink-2 text-readout font-medium tracking-tight">
						What has been happening
					</h1>
				</header>

				{days.length === 0 ? (
					<p className="label text-muted-foreground py-16 text-center text-legend">
						nothing dated in the file yet
					</p>
				) : (
					days.map((day) => (
						<section key={day.date}>
							<StripHead
								label={day.label}
								note={day.age}
								hues={[
									...new Set(
										day.events.map((event) => EVENT[event.kind].hue as Hue),
									),
								]}
								reading={day.count}
							/>

							<ul className="relative flex flex-col gap-1">
								{/* The spine, milled into the panel and running behind the
								    medallions. Inset top and bottom so it reads as a run
								    between the day's first and last line, not a page rule. */}
								<span
									aria-hidden
									className="bg-border-strong absolute top-2 bottom-2 left-[12.5px] w-px"
								/>
								{day.events.map((event) => (
									<Row key={event.id} event={event} onOpen={onOpen} />
								))}
							</ul>
						</section>
					))
				)}
			</div>
		</main>
	);
}
