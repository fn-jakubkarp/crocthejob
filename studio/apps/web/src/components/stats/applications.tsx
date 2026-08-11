import { Ghost } from "lucide-react";
import { type CSSProperties, useState } from "react";
import { Plate } from "@/components/stats/plate";
import { Column, Reading } from "@/components/strip";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { type Answers, percent, type Week } from "@/lib/jobs";
import { HUE, type Hue, tint } from "@/lib/strip";
import { cn } from "@/lib/utils";

/**
 * The two readings that only mean anything together, side by side: the rate applications
 * went out at, and what came back from them. Six live applications is one thing after a
 * busy month and another after three empty weeks, and a 68% silence rate is one thing at
 * five applications a week and another at one.
 */

/**
 * What went out, week by week, against the run's own average. Every week keeps its slot
 * whether or not anything went out in it: an empty week is the finding, so it has to read
 * as a gap in the run rather than as a missing bar.
 */
function Sent({
	weeks,
	sent,
	applied,
}: {
	weeks: Week[];
	sent: number;
	/** Applications the funnel counts, which is more than the dated ones. */
	applied: number;
}) {
	const last = weeks.length - 1;
	const counts = weeks.map((week) => week.count);
	const busiest = Math.max(1, ...counts);
	const mean = counts.reduce((a, b) => a + b, 0) / (weeks.length || 1);

	return (
		<div className="flex min-h-0 flex-1 flex-col" style={tint("applied")}>
			<div className="mb-2 flex shrink-0 items-baseline gap-3">
				<span className="legend text-muted-foreground text-legend">
					Sent, by week
				</span>
				<span className="legend text-muted-foreground ml-auto shrink-0 text-legend tabular-nums">
					{sent < applied ? `${sent} of ${applied} dated` : `${sent} out`}
				</span>
			</div>

			<div className="relative flex min-h-16 flex-1 items-end gap-1">
				{/* The average, drawn where it falls rather than stated in the heading:
				    the question a rate chart is read for is which weeks came in under it,
				    and the figure belongs on the window it was taken over. */}
				<span
					aria-hidden
					className="absolute inset-x-0 z-10 flex justify-end border-t border-dashed border-border-strong"
					style={{ bottom: `${(mean / busiest) * 100}%` }}
				>
					<span className="bg-card text-muted-foreground -translate-y-1/2 px-1 font-data text-data tabular-nums">
						{mean.toFixed(1)}/wk
					</span>
				</span>
				{weeks.map((week, i) => (
					// The slot is the target, not the bar: an empty week is the finding here
					// and a week with nothing in it has no bar to point at at all.
					<Tooltip key={week.label}>
						<TooltipTrigger
							render={<span />}
							className="relative block h-full min-w-0 flex-1 rounded-t-[3px] transition-colors duration-150 ease-out hover:bg-surface"
						>
							{/* The week in progress is the only bar that can still change, so it
							    is the only one at full strength. */}
							<Column
								fill={week.height}
								delay={i * 30}
								className={cn("absolute inset-0", i !== last && "opacity-65")}
							/>
						</TooltipTrigger>
						<TooltipContent>
							{week.count === 0
								? `nothing sent, week of ${week.label}`
								: `${week.count} sent, week of ${week.label}`}
						</TooltipContent>
					</Tooltip>
				))}
			</div>

			<div className="rule mt-1 shrink-0" />
			<div className="text-muted-foreground mt-1 flex shrink-0 items-baseline justify-between font-data text-data tabular-nums">
				<span>{weeks[0]?.label}</span>
				<span>this week</span>
			</div>
		</div>
	);
}

/**
 * What came back, as one bar of the applications that went out. Five buckets, each
 * application in exactly one, so the bar is the whole story at a glance: silence, not
 * rejection, is what ends them.
 *
 * Five rather than the four this used to print, because the fourth was "answered" and
 * nobody could read it: a recruiter call and a rejection letter are both a human
 * replying, and filing them together produced a figure that meant nothing. Each label
 * here is the thing that happened, in the words it happened in.
 *
 * Steel is silence - the commonest reading and the least consequential, which is what
 * the hue is for - so red is free to mean an actual no, and withdrawal takes the one
 * hue on the timeline this page does not otherwise use.
 */
const CAME_BACK: {
	id: Exclude<keyof Answers, "sent">;
	label: string;
	hue: Hue;
}[] = [
	{ id: "advanced", label: "Reached a call", hue: "screening" },
	{ id: "open", label: "Still open", hue: "applied" },
	{ id: "rejected", label: "Rejected", hue: "closed" },
	{ id: "withdrew", label: "I withdrew", hue: "added" },
	{ id: "silent", label: "Never answered", hue: "found" },
];

function CameBack({ answers }: { answers: Answers }) {
	const { sent } = answers;
	// Which bucket the pointer is on, from either half: the bar segment and its legend
	// row are one control, and 1% of a bar is three pixels wide to point at.
	const [lit, setLit] = useState<string | null>(null);
	const rows = CAME_BACK.map((row) => ({
		...row,
		count: answers[row.id],
		share: sent > 0 ? answers[row.id] / sent : 0,
	}));

	return (
		// Centred, not top-aligned: a bar and five rows are shorter than the chart beside
		// them, and the surplus reads as air around a reading rather than as a hole under
		// one. The heading stays with it, so the column reads as one block.
		<div className="flex min-h-0 flex-col justify-center">
			<div className="mb-2 flex shrink-0 items-baseline gap-3">
				<span className="legend text-muted-foreground text-legend">
					What came back
				</span>
				<span className="legend text-muted-foreground ml-auto shrink-0 text-legend tabular-nums">
					{sent} sent
				</span>
			</div>

			{sent === 0 ? (
				<p className="label text-muted-foreground py-6 text-center text-legend">
					no application has gone out
				</p>
			) : (
				<>
					{/* One groove, divided. A bar per row would be five measurements of five
					    different things; this is one measurement of one. */}
					<div
						aria-hidden
						className="bg-track flex h-2.5 shrink-0 overflow-hidden rounded-full"
					>
						{rows
							.filter((row) => row.count > 0)
							.map((row) => (
								<span
									key={row.id}
									onMouseEnter={() => setLit(row.id)}
									onMouseLeave={() => setLit(null)}
									// Dimmed rather than lifted: a segment cannot leave a bar it
									// is a share of, so the others step back instead.
									className="meter-slug block h-full origin-left transition-opacity duration-150 ease-out"
									style={
										{
											width: `${row.share * 100}%`,
											background: HUE[row.hue],
											"--fill": 1,
											opacity: lit && lit !== row.id ? 0.4 : 1,
										} as CSSProperties
									}
								/>
							))}
					</div>

					<ul className="mt-2.5 flex min-h-0 flex-col gap-0.5 overflow-y-auto">
						{rows.map((row) => (
							<li
								key={row.id}
								onMouseEnter={() => setLit(row.id)}
								onMouseLeave={() => setLit(null)}
								className={cn(
									"-mx-2 flex items-baseline gap-2.5 rounded-key px-2 py-1 transition-colors duration-150 ease-out",
									lit === row.id && "bg-surface",
								)}
							>
								{row.id === "silent" ? (
									<Ghost
										aria-hidden
										className="size-3.5 shrink-0 self-center"
										style={{ color: HUE[row.hue] }}
									/>
								) : (
									<span
										aria-hidden
										className="size-2.5 shrink-0 self-center rounded-[3px]"
										style={{ background: HUE[row.hue] }}
									/>
								)}
								<span className="text-ink-2 truncate text-body font-medium">
									{row.label}
								</span>
								<Reading
									value={row.count}
									size="text-body"
									className="text-muted-foreground ml-auto"
								/>
								<Reading
									value={percent(row.share)}
									size="text-body"
									className="w-10 text-right"
								/>
							</li>
						))}
					</ul>
				</>
			)}
		</div>
	);
}

export function Applications({
	weeks,
	sent,
	applied,
	answers,
}: {
	weeks: Week[];
	sent: number;
	applied: number;
	answers: Answers;
}) {
	// The two rates this whole plate exists to produce, stated in its heading rather than
	// left to be worked out from a five-row legend at the bottom of the page.
	return (
		<Plate
			title="Applications"
			reading={
				answers.sent > 0
					? `${percent(answers.advanced / answers.sent)} reached a call · ${percent(answers.silent / answers.sent)} never answered`
					: undefined
			}
		>
			{/* Two columns, not stacked: neither reading is worth much without the other
			    beside it, and stacked they took a plate's whole height between them. */}
			<div className="grid min-h-0 flex-1 gap-4 sm:grid-cols-2 sm:gap-5">
				<Sent weeks={weeks} sent={sent} applied={applied} />
				<CameBack answers={answers} />
			</div>
		</Plate>
	);
}
