import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Job, Lane } from "@/lib/jobs";
import { cn } from "@/lib/utils";

export /**
 * Both readings always, in the same two slots: /rank's score and /scrape's pre-check.
 * Having one and not the other says so, never reshuffles.
 */
function ScoreFit({
	job,
	scored,
	lane,
}: {
	job: Job;
	scored: boolean;
	lane?: Lane;
}) {
	return (
		<div className="bg-surface border border-border rounded-key flex items-stretch gap-3 px-3 py-2">
			<div className="min-w-0 flex-1">
				<Tooltip>
					<TooltipTrigger
						render={
							<p className="legend w-max cursor-help text-muted-foreground text-legend border-b border-dashed border-muted-foreground/40" />
						}
					>
						Score
					</TooltipTrigger>
					<TooltipContent side="top">
						Overall match evaluated by the AI agent
					</TooltipContent>
				</Tooltip>
				{scored ? (
					<p className="mt-1 flex items-baseline gap-2">
						<span className="text-readout font-data leading-none font-semibold tracking-[-0.02em] tabular-nums">
							{job.rank_score}
						</span>
						<span className="text-muted-foreground truncate text-body">
							{job.rank_verdict ?? "no verdict"}
						</span>
					</p>
				) : (
					<p className="text-muted-foreground/70 mt-1 text-body">
						{/* The nudge only while triaging: an application in flight is past
						    scoring, and /rank on it is how "not yet ranked" landed on a
						    tech interview. */}
						{lane === "intake" ? (
							<>
								not scored - run <span className="text-ink-2">/rank</span>
							</>
						) : (
							"not scored"
						)}
					</p>
				)}
			</div>

			<div aria-hidden className="bg-border w-px shrink-0" />

			<div
				className={cn(
					"w-24 shrink-0",
					job.fit === "high" && "[--lamp:var(--lamp-high)]",
					job.fit === "medium" && "[--lamp:var(--lamp-mid)]",
					job.fit === "low" && "[--lamp:var(--lamp-low)]",
				)}
			>
				<Tooltip>
					<TooltipTrigger
						render={
							<p className="legend w-max cursor-help text-muted-foreground text-legend border-b border-dashed border-muted-foreground/40" />
						}
					>
						Fit
					</TooltipTrigger>
					<TooltipContent side="top">Quick initial triage level</TooltipContent>
				</Tooltip>
				{job.fit ? (
					<p className="mt-1 flex items-center gap-1.5">
						<span aria-hidden className="lamp size-1.5" />
						<span className="font-stretch-[86%] text-meta font-semibold tracking-[0.07em] uppercase">
							{job.fit}
						</span>
					</p>
				) : (
					<p className="text-muted-foreground/70 mt-1 text-body">not judged</p>
				)}
			</div>
		</div>
	);
}
