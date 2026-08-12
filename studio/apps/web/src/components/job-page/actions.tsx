import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { type CommandId, commandsFor, type Job, stageOf } from "@/lib/jobs";
import { cn } from "@/lib/utils";

/**
 * What can be asked of this entry, at the stage it is at.
 *
 * The set changes with the column, because the useful question changes with it: an entry
 * nobody has applied to wants scoring and a CV, one sitting in Screening wants prep for
 * the call that is booked. `commandsFor` holds that table and is tested; this only draws
 * it.
 *
 * A blocked command is drawn dimmed with its reason on hover rather than hidden. It costs
 * a request against the subscription to learn the same thing from a failed run.
 */
export function Actions({
	job,
	busy,
	running,
	onRun,
}: {
	job: Job;
	/** A run is going, anywhere. One at a time, matching the server's lock. */
	busy: boolean;
	/** The one command actually running against this entry, if it is this entry's. */
	running?: CommandId | null;
	onRun: (command: CommandId, stage?: string) => void;
}) {
	const offered = commandsFor(job);
	const stage = stageOf(job);
	// A closed entry that has been scored has nothing left to ask for, and an empty
	// heading over an empty box is worse than no block at all.
	if (offered.length === 0) return null;

	return (
		<div>
			<p className="label text-muted-foreground mb-2 text-data">Ask Claude</p>
			<div className="flex flex-col gap-1">
				{offered.map(({ def, blocked }) => {
					const key = def.id;
					const button = (
						<Button
							key={key}
							variant="ghost"
							size="sm"
							disabled={busy || Boolean(blocked)}
							onClick={() =>
								onRun(key, key === "interview" ? stage : undefined)
							}
							className={cn(
								"text-ink-2 hover:bg-card hover:text-foreground h-auto w-full justify-start gap-2 px-2 py-1.5 text-left",
								blocked && "opacity-45",
							)}
						>
							{/* The spinner marks the command that is running, not every button
							    the run happens to have disabled: five of them turning at once
							    said five things were going. */}
							{running === key ? (
								<Loader2 className="size-3.5 shrink-0 animate-spin" />
							) : (
								<Play className="size-3.5 shrink-0" />
							)}
							<span className="min-w-0 flex-1">
								<span className="block text-meta font-medium">{def.label}</span>
								<span className="text-muted-foreground block text-data leading-[1.4] font-normal text-wrap">
									{blocked ?? def.said}
								</span>
							</span>
						</Button>
					);

					// A disabled control takes no pointer events, so the reason needs a
					// wrapper to hang off. Only drawn when there is one to give.
					return blocked ? (
						<Tooltip key={key}>
							<TooltipTrigger render={<div className="w-full" />}>
								{button}
							</TooltipTrigger>
							<TooltipContent side="left">{blocked}</TooltipContent>
						</Tooltip>
					) : (
						<div key={key}>{button}</div>
					);
				})}
			</div>
		</div>
	);
}
