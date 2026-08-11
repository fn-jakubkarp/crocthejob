import { useMemo } from "react";
import { Applications } from "@/components/stats/applications";
import { Attention } from "@/components/stats/attention";
import { Funnel } from "@/components/stats/funnel";
import { Mix } from "@/components/stats/mix";
import { Plate } from "@/components/stats/plate";
import { Ranking } from "@/components/stats/ranking";
import {
	buildStats,
	type DupIndex,
	type Job,
	type OutcomeId,
	percent,
	type Status,
} from "@/lib/jobs";

/**
 * The search, measured.
 *
 * THESIS. Four plates, each answering one question, laid out across the window rather
 * than down a column of text: where the search stands, what needs chasing today, what
 * the ranked queue holds and what is about to expire in it, and what came back.
 *
 * THE PAGE IS THE WINDOW. Four plates, two rows, no scrollbar at desk width. The
 * earlier build sized rows to their content to avoid dead space, and got it anyway: a
 * row is as tall as its taller plate either way, so the shorter one pooled the surplus
 * under a chart that would not grow. The fix is charts that fill - the dial takes the
 * height it is given - not rows that shrink. Below `xl`, and under a window too short
 * to hold the row floors, it stacks and scrolls like any other page.
 *
 * EVERY READING IS A RATIO OR A ROW TO ACT ON. A total on its own says nothing here:
 * 143 queued is a number, 51 of them scored 60 or above and still sitting is a
 * decision. The counts that survive are the ones a share is taken against, and each
 * plate states its own finding as a rate in its heading, where it is read before any
 * chart under it.
 *
 * TWO PLATES ARE ORDERED BY WHAT TO DO FIRST. `Needs an answer` sorts by how far past
 * its own silence threshold each wait is - by stage first among the live processes, where
 * the stage reached outranks the clock - and the ranked queue closes on what expires
 * soonest. Neither is a ranking of importance invented here; both are a debt already
 * owed, printed in the order it came due. Right-click any of those rows to act on it
 * without leaving the page.
 *
 * WORLD. The board's, inverted. There, recessed wells hold raised cards. Here, raised
 * plates have their readings milled into them as grooves — `--track`, the one surface
 * plane the board never uses.
 *
 * COLOUR. The timeline's eight hues, and nothing invented here: a stage is the colour
 * it is on the day it happened, an ending is the ending's red, /rank's bands are its
 * own verdict. Every figure is in the data face; every share is a slug seated in a
 * groove; the word always rides with the colour, so no reading rests on hue alone.
 *
 * WHY FOUR. A plate is a subject, not a card: the dial and the funnel are one reading
 * of the pipeline split by a rule; /rank's verdict and the deadlines running out on it
 * are one queue; and the rate applications went out at only means anything beside what
 * came back from them.
 *
 * MOTION. One authored moment: every meter and every arc seats itself from zero,
 * staggered across the page, like a panel coming up to pressure. Nothing else moves.
 */

type Props = {
	jobs: Job[];
	dupes: DupIndex;
	/**
	 * Opens that column on the board, filtered to `query` when the reading was about one
	 * posting. A reading you cannot act on stops being read.
	 */
	onOpen: (status: Status, query?: string) => void;
	/** Tags an application and closes it in one write - see `toggleOutcome`. */
	onOutcome: (key: string, tag: OutcomeId) => void;
	onStatus: (key: string, status: Status) => void;
};

export function StatsPage({ jobs, dupes, onOpen, onOutcome, onStatus }: Props) {
	// Postings, never entries: a duplicate copy is the same posting under a second
	// URL, so counting it twice would put the board and this page into disagreement.
	const stats = useMemo(
		() => buildStats(jobs.filter((job) => !dupes.of.has(job.key))),
		[jobs, dupes],
	);

	return (
		<main className="min-h-0 flex-1 overflow-y-auto p-3 pl-[4.5rem]">
			<h1 className="sr-only">Search stats</h1>

			{/* Two rows and two columns at desk width, sized to the window rather than to
			    the content: the wide column takes the two dense instruments, the narrow one
			    the two lists. The row floor is the escape hatch - under a window too short
			    for it the grid outgrows `h-full` and the page scrolls, rather than clipping
			    a plate. Below `xl` the plates stack. */}
			<div className="grid grid-cols-1 gap-3 xl:h-full xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] xl:grid-rows-[minmax(17rem,1fr)_minmax(17rem,1fr)]">
				<Plate
					title="Pipeline"
					// The funnel draws this as a meter and never prints it: what share of
					// everything ever seen turned into an application.
					reading={`${percent(stats.applied / (stats.seen || 1))} applied`}
				>
					<div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(11rem,16rem)_1px_minmax(0,1fr)] lg:gap-5">
						<Mix slices={stats.mix} seen={stats.seen} onOpen={onOpen} />
						<div aria-hidden className="rule-v hidden lg:block" />
						<Funnel stages={stats.funnel} onOpen={onOpen} />
					</div>
				</Plate>

				<Attention
					waiting={stats.waiting}
					onOpen={onOpen}
					onOutcome={onOutcome}
					onStatus={onStatus}
				/>

				<Ranking
					buckets={stats.buckets}
					bands={stats.bands}
					scored={stats.scored}
					scoredApplied={stats.scoredApplied}
					sent={stats.answers.sent}
					due={stats.due}
					lapsed={stats.lapsed}
					onOpen={onOpen}
					onOutcome={onOutcome}
					onStatus={onStatus}
				/>

				<Applications
					weeks={stats.weeks}
					sent={stats.sent}
					applied={stats.applied}
					answers={stats.answers}
				/>
			</div>
		</main>
	);
}
