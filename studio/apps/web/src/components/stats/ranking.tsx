import { Plate } from "@/components/stats/plate";
import { Region, Row, type RowActions } from "@/components/stats/row";
import { Chip, Column, Reading } from "@/components/strip";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Due, ScoreBand, ScoreBucket } from "@/lib/jobs";
import { columnOf, scoreLamp } from "@/lib/jobs";
import { HUE, type Hue, tint } from "@/lib/strip";

type Props = {
	buckets: ScoreBucket[];
	bands: ScoreBand[];
	scored: number;
	/** Scored postings an application went out on. */
	scoredApplied: number;
	/** Applications sent in total, scored or not - what gives the figure above a scale. */
	sent: number;
	/** Queued postings still open, soonest deadline first. */
	due: Due[];
	/** Queued postings whose deadline has already passed. */
	lapsed: number;
} & RowActions;

/**
 * The queue: what /rank concluded, what was then done about it, and what is running out.
 *
 * The distribution is the only reading on this page that is not a share of a whole, and
 * on its own it only describes the queue; the solid part of each bar and the table beside
 * it are what it cost or earned, which is the part worth reading. Under them is the same
 * queue with a clock on it - the postings that expire first - because a verdict and the
 * days left to act on it are one subject, and split across two plates neither was.
 *
 * Colour is /rank's own verdict and nothing else: green is the band it calls worth
 * applying to, amber the band it says to apply to and address the gaps, steel the rest.
 * The 70s straddle the line at 75, so that decade stays amber - a bucket cannot say which
 * side its postings fell, and the band table beside it prints the thresholds exactly.
 */

const bandOf = (score: number): Hue => {
	const lamp = scoreLamp(score);
	return lamp === "high" ? "offer" : lamp === "medium" ? "ranked" : "found";
};

const BAND_HUE: Record<ScoreBand["id"], Hue> = {
	high: "offer",
	medium: "ranked",
	low: "found",
};

/** /rank's own three bands, so a score in the closing list reads as it does on a card. */
const SCORE_HUE = { high: "offer", medium: "ranked", low: "found" } as const;

const CELL =
	"grid grid-cols-[4.5rem_repeat(3,minmax(0,1fr))] items-center gap-x-3";

/** Rows the closing list prints before it defers to the board. */
const CAP = 4;

/** `today`, `in 3d`. Days, not a date: the count is the urgency. */
const closes = (days: number) =>
	days === 0 ? "today" : days === 1 ? "in 1d" : `in ${days}d`;

const nameOf = (row: Due) => row.job.company ?? row.job.title ?? "Untitled";

function Closing({
	due,
	lapsed,
	onOpen,
	onOutcome,
	onStatus,
}: { due: Due[]; lapsed: number } & RowActions) {
	return (
		<Region
			label="Closing soon"
			reading={lapsed > 0 ? `${lapsed} already lapsed` : "none lapsed"}
			empty="nothing in the queue has a deadline"
			cap={CAP}
			className="shrink-0"
			onAll={() => onOpen("ranked")}
		>
			{due.map((row) => {
				const band = row.score == null ? null : scoreLamp(row.score);
				const hue = band ? HUE[SCORE_HUE[band]] : undefined;
				return (
					<Row
						key={row.job.key}
						job={row.job}
						lamp={hue ?? "var(--lamp-low)"}
						name={nameOf(row)}
						note={
							row.score == null ? (
								"unscored"
							) : (
								<Reading value={row.score} size="text-meta" />
							)
						}
						noteColour={hue}
						reading={closes(row.days)}
						// A week is the board's own "soon" - see `deadlineRead`.
						urgent={row.days <= 7}
						label={`Closes ${closes(row.days)}. Open ${nameOf(row)}`}
						open={() => onOpen(columnOf(row.job), row.job.company)}
						onOutcome={onOutcome}
						onStatus={onStatus}
					/>
				);
			})}
		</Region>
	);
}

export function Ranking({
	buckets,
	bands,
	scored,
	scoredApplied,
	sent,
	due,
	lapsed,
	onOpen,
	onOutcome,
	onStatus,
}: Props) {
	if (scored === 0) {
		return (
			<Plate title="The ranked queue" reading="0 scored">
				<p className="label text-muted-foreground my-auto py-6 text-center text-legend">
					nothing scored yet
				</p>
			</Plate>
		);
	}

	// The finding the plate is read for, stated in its heading: a verdict worth acting on
	// that nothing has been done about yet. See the page's own note on ratios over totals.
	const stalled = bands
		.filter((band) => band.id !== "low")
		.reduce((sum, band) => sum + band.queued, 0);

	return (
		<Plate
			title="The ranked queue"
			reading={`${scored} scored · ${stalled} queued at 60+`}
		>
			<div className="grid min-h-0 flex-1 gap-x-6 gap-y-4 lg:grid-cols-[1.4fr_1fr]">
				<div className="flex min-h-0 flex-col">
					<span className="text-muted-foreground mb-2 block text-legend legend">
						Scores{" "}
						<span className="text-muted-foreground/70">· solid = applied</span>
					</span>
					{/* Capped, not stretched: eight decades spread across a 600px plate stop
					    reading as a distribution and start reading as eight panels. */}
					<div className="-mx-1 flex min-h-[5.5rem] max-w-[26rem] flex-1 gap-1 sm:gap-1.5">
						{buckets.map((bucket, i) => (
							// The whole decade is the target, not the bar: a 7-posting column is
							// a few pixels tall and nobody can point at it. The tooltip says what
							// the two tones are, which is the one thing the axis cannot.
							<Tooltip key={bucket.floor}>
								<TooltipTrigger
									render={<div />}
									style={tint(bandOf(bucket.floor))}
									className="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-key px-1 py-1 transition-colors duration-150 ease-out hover:bg-surface"
								>
									<Reading
										value={bucket.count}
										size="text-data"
										className="text-muted-foreground"
									/>
									{/* Two tones, one bar: the whole decade, and the part of it an
									    application went out on. A second bar beside it would be a
									    second measurement of the same postings. */}
									<span className="relative block w-full flex-1">
										<Column
											fill={bucket.height}
											delay={i * 45}
											className="absolute inset-0 opacity-30"
										/>
										<Column
											fill={
												bucket.height * (bucket.applied / (bucket.count || 1))
											}
											delay={i * 45}
											className="absolute inset-0"
										/>
									</span>
									<span className="text-muted-foreground font-data text-data tabular-nums">
										{bucket.floor}
									</span>
								</TooltipTrigger>
								<TooltipContent>
									{bucket.count} scored {bucket.floor}-{bucket.floor + 9},{" "}
									{bucket.applied} applied to
								</TooltipContent>
							</Tooltip>
						))}
					</div>
				</div>

				<div className="flex flex-col">
					<span className="text-muted-foreground mb-2 block text-legend legend">
						By verdict
					</span>
					<div
						className={`${CELL} text-muted-foreground mb-1 text-legend legend`}
					>
						<span>Band</span>
						<span className="text-right">Scored</span>
						<span className="text-right">Applied</span>
						<span className="text-right">Queued</span>
					</div>
					<div className="flex flex-col gap-1">
						{bands.map((band) => (
							<div
								key={band.id}
								style={tint(BAND_HUE[band.id])}
								className={CELL}
							>
								<Chip>{band.label}</Chip>
								<Reading
									value={band.scored}
									size="text-body"
									className="text-ink-2 text-right"
								/>
								<Reading
									value={band.applied}
									size="text-body"
									className="text-right"
								/>
								{/* The finding: what the verdict is still waiting on. */}
								<Reading
									value={band.queued}
									size="text-body"
									className="text-muted-foreground text-right"
								/>
							</div>
						))}
					</div>
					<p className="text-muted-foreground mt-2 shrink-0 text-meta">
						<span className="text-foreground font-data font-medium tabular-nums">
							{scoredApplied}
						</span>{" "}
						of{" "}
						<span className="text-foreground font-data font-medium tabular-nums">
							{sent}
						</span>{" "}
						applications came from this queue.
					</p>
				</div>
			</div>

			<div className="rule mt-3 mb-2.5 shrink-0" />
			<Closing
				due={due}
				lapsed={lapsed}
				onOpen={onOpen}
				onOutcome={onOutcome}
				onStatus={onStatus}
			/>
		</Plate>
	);
}
