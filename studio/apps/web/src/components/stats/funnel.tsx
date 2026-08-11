import { Chip, Meter, Reading } from "@/components/strip";
import { type FunnelStage, percent, type Status } from "@/lib/jobs";
import { CHIP_LABEL, STATUS_HUE, tint } from "@/lib/strip";
import { cn } from "@/lib/utils";

/**
 * How far each posting ever got, stage by stage, cumulative: a stage counts everything
 * that reached it or further. The figure that matters is the drop between two rows, so
 * the step is printed beside the total rather than left to be worked out.
 *
 * Colour is the timeline's, not a gradient: the stage a bar measures is the colour that
 * stage is everywhere else in the app, and the chip carries the word so nothing here
 * rests on the colour alone.
 */

const ROW =
	"grid grid-cols-[minmax(0,1fr)_auto_3rem] items-center gap-x-3 gap-y-2 sm:grid-cols-[7rem_4.75rem_minmax(0,1fr)_3rem] sm:gap-x-4 sm:gap-y-0";

export function Funnel({
	stages,
	onOpen,
}: {
	stages: FunnelStage[];
	onOpen: (status: Status) => void;
}) {
	// The population row is dropped: the dial immediately to the left already states it
	// as the page's one display figure, and row one's step is measured against it either
	// way. Every row left is a column you can open, so there is one row shape here.
	const rows = stages.filter((stage) => stage.status !== null);

	return (
		<div className="flex min-h-0 flex-col justify-center">
			<div
				className={cn(ROW, "text-muted-foreground mb-1.5 text-legend legend")}
			>
				<span className="sm:order-1">Stage</span>
				<span className="text-right sm:order-2">Reached</span>
				<span className="text-right sm:order-4">Step</span>
				<span aria-hidden className="hidden sm:order-3 sm:block" />
			</div>

			<div className="flex flex-col">
				{rows.map((stage, i) => {
					const status = stage.status as Status;
					const step = stage.ofPrevious;
					return (
						<button
							key={stage.label}
							type="button"
							style={tint(STATUS_HUE[status])}
							onClick={() => onOpen(status)}
							className={cn(
								ROW,
								"-mx-2 rounded-key px-2 py-2 text-left transition-colors duration-150 ease-out hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal",
							)}
						>
							<Chip className="w-[5.75rem] sm:order-1">
								{CHIP_LABEL[status]}
							</Chip>
							{/* Not a display size. Six of these stacked at 27px read as the
							    headline of the page, and the dial beside them is the figure
							    the page opens on; the step to their right is the finding. */}
							<Reading
								value={stage.reached}
								size="text-plate"
								className="text-right leading-none sm:order-2"
							/>
							{/* The step is the finding: what a stage kept of the one above it. */}
							<span className="text-muted-foreground text-right font-data text-data tabular-nums sm:order-4">
								{step === null ? (
									"—"
								) : (
									<>
										<span aria-hidden>{percent(step)}</span>
										<span className="sr-only">
											{percent(step)} of the stage above
										</span>
									</>
								)}
							</span>
							<Meter
								fill={stage.ofSeen}
								delay={i * 55}
								className="col-span-3 sm:order-3 sm:col-span-1"
							/>
							<span className="sr-only">Open the {stage.label} column</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}
