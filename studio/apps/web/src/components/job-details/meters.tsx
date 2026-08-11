import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { DIMENSIONS, type Job } from "@/lib/jobs";
import { cn } from "@/lib/utils";

export /**
 * /rank's four axes as level meters. A missing axis keeps its row with an empty
 * rail: fixed frame, not a list of whatever came back. Four empty rails add nothing
 * an unranked entry has not already said above, so an untouched entry drops it.
 */
function Meters({ dims }: { dims: Job["rank_dimensions"] }) {
	const any =
		!!dims && DIMENSIONS.some(({ id }) => typeof dims[id] === "number");
	if (!any) return null;
	return (
		<div>
			<Tooltip>
				<TooltipTrigger
					render={
						<p className="label w-max cursor-help text-muted-foreground mb-2 text-data border-b border-dashed border-muted-foreground/40" />
					}
				>
					Rank breakdown
				</TooltipTrigger>
				<TooltipContent side="top">
					Detailed scores across your preferences (0-100)
				</TooltipContent>
			</Tooltip>
			<div className="space-y-1.5">
				{DIMENSIONS.map(({ id, label }) => {
					const v = dims?.[id];
					return (
						<div key={id} className="flex items-center gap-2.5">
							<span className="text-muted-foreground w-[4.75rem] shrink-0 text-meta">
								{label}
							</span>
							{/* 9px, not 5px: an inset shadow has nowhere to render below that. */}
							<span className="bg-track relative h-[9px] w-[8rem] shrink-0 overflow-hidden rounded-full">
								{typeof v === "number" && (
									<span
										className="bg-signal absolute inset-y-[1.5px] left-[1.5px] rounded-full shadow-[inset_0_1px_0_oklch(1_0_0/0.4),inset_0_-1px_0_oklch(0_0_0/0.22)]"
										style={{
											width: `calc(${Math.min(100, Math.max(0, v))}% - 3px)`,
										}}
									/>
								)}
							</span>
							<span
								className={cn(
									"w-5 shrink-0 text-right text-meta font-semibold",
									typeof v === "number"
										? "font-data tabular-nums"
										: "text-muted-foreground/70",
								)}
							>
								{typeof v === "number" ? v : "-"}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}
