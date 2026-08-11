import { chip } from "@/components/job-details/chip";
import {
	type Job,
	OUTCOME_GROUPS,
	OUTCOMES_BY_GROUP,
	type OutcomeId,
	outcomeTags,
} from "@/lib/jobs";

export /**
 * Rejected only, where it leads the panel: a live card has no answer yet, and the
 * right-click submenu covers the moment it gets one.
 */
function Outcome({
	job,
	onOutcome,
	onClearOutcome,
}: {
	job: Job;
	onOutcome: (tag: OutcomeId) => void;
	onClearOutcome: () => void;
}) {
	const held = new Set(outcomeTags(job).map((t) => t.id));
	return (
		<div>
			<div className="mb-2 flex items-baseline justify-between gap-2">
				<p className="label text-muted-foreground text-data">Outcome</p>
				{held.size > 0 ? (
					<button
						type="button"
						onClick={() => onClearOutcome()}
						className="text-muted-foreground hover:text-foreground relative text-meta font-medium transition-colors after:absolute after:-inset-2 after:content-['']"
					>
						clear
					</button>
				) : (
					<span className="text-muted-foreground text-meta italic">
						they just said no
					</span>
				)}
			</div>
			<div className="space-y-2.5">
				{OUTCOME_GROUPS.map((group) => (
					<div key={group.id}>
						<p className="legend text-muted-foreground text-legend">
							{group.label}
						</p>
						<div className="mt-1 flex flex-wrap gap-1.5">
							{OUTCOMES_BY_GROUP[group.id].map((tag) => (
								<button
									key={tag.id}
									type="button"
									onClick={() => onOutcome(tag.id)}
									aria-pressed={held.has(tag.id)}
									className={chip(held.has(tag.id))}
								>
									{tag.label}
								</button>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
