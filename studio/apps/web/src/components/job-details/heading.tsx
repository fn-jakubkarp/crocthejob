import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DupCopy, Job } from "@/lib/jobs";

export /** The id, the title, and the company the entry belongs to. */
function Heading({
	job,
	copy,
	onEdit,
}: {
	job: Job;
	copy?: DupCopy;
	onEdit: () => void;
}) {
	return (
		<div>
			{/* The id first: the handle shared with the JSON and CLI skills, and on a
			    copy the only place both numbers are visible. */}
			{(job.id || copy) && (
				<p className="text-muted-foreground mb-1 font-data text-data tabular-nums">
					{job.id ? `#${job.id}` : "no id yet"}
					{copy && (
						<>
							{" · "}
							<span className="text-ink-2">
								{copy.label} - duplicate of #{copy.canonical.id ?? "?"}
							</span>
						</>
					)}
				</p>
			)}
			{/* The write path sits on the title line, at the panel's edge: the one control
			    in a panel that otherwise only reads, kept out of the reading column. */}
			<div className="flex items-start gap-2">
				<h3 className="min-w-0 flex-1 text-module leading-[1.25] font-[620] tracking-[-0.02em] break-words">
					{job.title?.replace(/\s+/g, " ").trim() || "(untitled)"}
				</h3>
				<Tooltip>
					<TooltipTrigger
						render={
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={onEdit}
								aria-label="Edit posting"
								// Optically on the title's first line, pulled into the panel's
								// own padding. The pseudo-element grows the 32px control to a
								// 40px target without moving it.
								className="text-muted-foreground hover:text-foreground relative -mt-0.5 -mr-1 after:absolute after:-inset-1"
							/>
						}
					>
						<Pencil />
					</TooltipTrigger>
					<TooltipContent side="left">Edit posting</TooltipContent>
				</Tooltip>
			</div>
			{/* Company only: mode and offices are fields below, same place every entry. */}
			<p className="text-muted-foreground mt-1 text-body leading-[1.45]">
				<span className="text-ink-2 font-medium">
					{job.company || "(no company)"}
				</span>
			</p>
		</div>
	);
}
