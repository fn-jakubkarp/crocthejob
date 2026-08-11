import { Plate } from "@/components/stats/plate";
import { Region, Row, type RowActions } from "@/components/stats/row";
import { Chip } from "@/components/strip";
import { COLUMNS, type Status, type Waiting } from "@/lib/jobs";
import { CHIP_LABEL, HUE, STATUS_HUE, tint } from "@/lib/strip";

/**
 * The one plate that is a list of things to do rather than a reading of what happened.
 * Two questions, and they are not the same question: what is actually live, and what has
 * gone quiet long enough to need a decision.
 *
 * IN PLAY is screening and above, deepest stage first and the longest wait first inside
 * each stage. An application sent last week is not a thing anybody owes an answer on yet,
 * and printing eight of them here buried the three processes that were real - which is
 * what this plate was getting wrong.
 *
 * FOLLOW UP is the rest: applications out with nobody back, in the order they come due
 * against a threshold that is per stage - three weeks for an application, a fortnight
 * for a live process. Past due reads amber and states what is owed (`+34d over`); the
 * rest stay in the list and say when they fall due, because "what is next" is half the
 * question and a list cut at the threshold could only answer "what is late".
 *
 * Every live application is in exactly one of the two, so the plate is the whole live
 * file and neither region is a slice of the other.
 *
 * The dot is the stage and only ever the stage, in the colour that stage is everywhere
 * else. It used to turn amber on a quiet row, which put two unrelated meanings on one
 * mark and made a blue dot look like a third: urgency belongs to the reading, where the
 * word is there to carry it.
 *
 * Right-click any row to say how it ended or move it, which is the action this list asks
 * for most and the one worth not leaving the page for.
 */

/** Rows each region prints before it defers to the board. */
const LIVE_CAP = 6;
const CHASE_CAP = 8;

const nameOf = (row: Waiting) => row.job.company ?? row.job.title ?? "Untitled";

/** Pipeline position, off the board's own column order. */
const stageRank = (status: Status) =>
	COLUMNS.findIndex((column) => column.status === status);

/**
 * The stage, as the anodized tag the funnel and the timeline already use for it rather
 * than as a coloured word. Fixed width, so the readings to its right line up down the
 * plate and the stages stack into one stripe.
 */
function StageChip({ status }: { status: Status }) {
	return (
		<Chip className="block w-[5.25rem] py-px" style={tint(STATUS_HUE[status])}>
			{CHIP_LABEL[status]}
		</Chip>
	);
}

/**
 * The debt, in the words either side of the line: past due it is what is owed, before
 * it is when it falls due. One column, so the line between them is where the amber
 * starts rather than a heading nobody reads twice. The word leads, so the column reads
 * as a state with a size on it rather than as a signed number.
 */
function debt(overdue: number): string {
	if (overdue > 0) return `overdue +${overdue}d`;
	if (overdue === 0) return "due today";
	return `due in ${-overdue}d`;
}

/**
 * No reading beside this plate's heading, and none beside either region's: every count
 * that could go there is the length of a list printed directly under it, which the
 * reader already has by looking.
 */

export function Attention({
	waiting,
	onOpen,
	onOutcome,
	onStatus,
}: {
	/** Every live application, most overdue first. */
	waiting: Waiting[];
} & RowActions) {
	// Every live application, in exactly one of the two regions: the processes with
	// something happening in them, and the applications nobody has come back on.
	//
	// IN PLAY groups by stage, deepest first, and only then by the wait: a final round is
	// the bigger thing to answer whatever the clock says, and the region prints six rows,
	// so a run of screenings must not push it off the list. The sort is stable, so inside
	// a stage the rows keep the order they arrive in - longest wait first.
	const live = waiting
		.filter((row) => row.status !== "applied")
		.sort((a, b) => stageRank(b.status) - stageRank(a.status));
	const cold = waiting.filter((row) => row.status === "applied");

	return (
		<Plate title="Needs an answer">
			{/* Tight: a chip is taller than the coloured word it replaced, and twelve of
			    them plus two headings is what has to fit between the plate's own edges. */}
			<div className="flex min-h-0 flex-1 flex-col gap-2">
				<Region
					label="In play"
					empty="no process past an application"
					cap={LIVE_CAP}
					className="shrink-0"
					onAll={() => onOpen("screening")}
				>
					{live.map((row) => (
						<Row
							key={row.job.key}
							job={row.job}
							lamp={HUE[STATUS_HUE[row.status]]}
							name={nameOf(row)}
							note={<StageChip status={row.status} />}
							reading={row.days === 0 ? "today" : `${row.days}d`}
							urgent={row.stale}
							label={`${row.stale ? "Quiet past the follow-up point. " : ""}Open ${nameOf(row)}`}
							open={() => onOpen(row.status, row.job.company)}
							onOutcome={onOutcome}
							onStatus={onStatus}
						/>
					))}
				</Region>

				<div className="rule shrink-0" />

				<Region
					label="Follow up"
					empty="no application is waiting on them"
					cap={CHASE_CAP}
					className="min-h-0 flex-1"
					onAll={() => onOpen("applied")}
				>
					{cold.map((row) => {
						const reading = debt(row.overdue ?? 0);
						return (
							<Row
								key={row.job.key}
								job={row.job}
								lamp={HUE[STATUS_HUE[row.status]]}
								name={nameOf(row)}
								note={<StageChip status={row.status} />}
								reading={reading}
								urgent={row.stale}
								label={`Quiet ${row.days} days, ${reading}. Open ${nameOf(row)}`}
								open={() => onOpen(row.status, row.job.company)}
								onOutcome={onOutcome}
								onStatus={onStatus}
							/>
						);
					})}
				</Region>
			</div>
		</Plate>
	);
}
