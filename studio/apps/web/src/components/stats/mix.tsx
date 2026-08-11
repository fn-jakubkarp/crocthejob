import { type CSSProperties, useState } from "react";
import { Reading } from "@/components/strip";
import { type MixSlice, percent, type Status } from "@/lib/jobs";
import { HUE, type Hue } from "@/lib/strip";
import { cn } from "@/lib/utils";

/**
 * Where the file sits *now*, which is the one thing the funnel cannot say: it reports
 * how far each posting ever got, so a posting passed over and a posting still queued
 * both count as "ranked" there and are opposite things here.
 *
 * Four arcs, not eight: a dial with a slice per column is a legend with a picture
 * attached. Every column belongs to exactly one group, so the four always total the
 * population, and the total is printed in the middle of the ring rather than beside it.
 *
 * The arc and its legend row are one control in two places: hovering either raises the
 * arc out of the groove and lifts the row, and clicking either opens the column. A mark
 * you can point at and get nothing back from reads as a picture rather than a reading,
 * and the arc is the half of this that carries the shape.
 */

/** Which colour each group carries, in the timeline's own hues. */
const MIX_HUE: Record<string, Hue> = {
	intake: "ranked",
	live: "applied",
	closed: "closed",
	passed: "found",
};

const R = 52;
const C = 2 * Math.PI * R;
/** A hairline of ground between arcs, so two neighbours never read as one. */
const GAP = 1.5;

export function Mix({
	slices,
	seen,
	onOpen,
}: {
	slices: MixSlice[];
	seen: number;
	onOpen: (status: Status) => void;
}) {
	// Which slice the pointer is on, whichever half of the control it is over.
	const [lit, setLit] = useState<string | null>(null);
	let turned = 0;

	return (
		<div className="flex min-h-0 flex-col items-center justify-center gap-3.5">
			{/* The dial takes the height the plate has left rather than a fixed diameter:
			    this is the reading the page opens on, and at a fixed 8.5rem it sat in the
			    middle of its own dead space. Square either way - it is a ring - so the two
			    caps are one measurement, and the floor keeps it legible on a short window. */}
			<div className="relative max-h-[15rem] min-h-[9rem] w-full max-w-[15rem] flex-1">
				<svg
					viewBox="0 0 128 128"
					className="size-full -rotate-90"
					role="img"
					aria-label={`${seen} postings: ${slices
						.map((slice) => `${slice.count} ${slice.label.toLowerCase()}`)
						.join(", ")}`}
				>
					{/* The groove the arcs are seated in, drawn whole so an empty group
					    leaves a milled gap rather than nothing. */}
					<circle
						cx="64"
						cy="64"
						r={R}
						fill="none"
						stroke="var(--track)"
						strokeWidth="15"
					/>
					{slices.map((slice, i) => {
						const length = Math.max(slice.share * C - GAP, 0);
						const offset = -turned * C;
						turned += slice.share;
						if (length <= 0) return null;
						return (
							<circle
								key={slice.id}
								cx="64"
								cy="64"
								r={R}
								fill="none"
								stroke={HUE[MIX_HUE[slice.id]]}
								// Raised out of the groove rather than recoloured or dimmed: the
								// hue is the group's and stays its own, and the arc under the
								// pointer is the one standing proud of the others.
								strokeWidth={lit === slice.id ? 19 : 15}
								strokeLinecap="butt"
								className="ring-seat cursor-pointer transition-[stroke-width] duration-150 ease-out"
								onMouseEnter={() => setLit(slice.id)}
								onMouseLeave={() => setLit(null)}
								onClick={() => onOpen(slice.status)}
								style={
									{
										"--ring-c": C,
										strokeDasharray: `${length} ${C}`,
										strokeDashoffset: offset,
										animationDelay: `${i * 90}ms`,
									} as CSSProperties
								}
							>
								<title>
									{slice.count} {slice.label.toLowerCase()} ·{" "}
									{percent(slice.share)}
								</title>
							</circle>
						);
					})}
				</svg>
				<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
					<Reading value={seen} size="text-headline" className="leading-none" />
					<span className="legend text-muted-foreground mt-1 text-legend">
						postings
					</span>
				</div>
			</div>

			<ul className="flex w-full shrink-0 flex-col">
				{slices.map((slice) => (
					<li key={slice.id}>
						<button
							type="button"
							onClick={() => onOpen(slice.status)}
							onMouseEnter={() => setLit(slice.id)}
							onMouseLeave={() => setLit(null)}
							onFocus={() => setLit(slice.id)}
							onBlur={() => setLit(null)}
							className={cn(
								"-mx-2 flex w-full items-center gap-2.5 rounded-key px-2 py-1 text-left transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal",
								lit === slice.id && "bg-surface",
							)}
						>
							<span
								aria-hidden
								className="size-2.5 shrink-0 rounded-[3px]"
								style={{ background: HUE[MIX_HUE[slice.id]] }}
							/>
							<span className="text-ink-2 min-w-0 flex-1 truncate text-body font-medium">
								{slice.label}
							</span>
							<Reading value={slice.count} className="text-ink-2" />
							<Reading
								value={percent(slice.share)}
								size="text-meta"
								className="text-muted-foreground w-9 text-right"
							/>
							<span className="sr-only">Open the column</span>
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}
