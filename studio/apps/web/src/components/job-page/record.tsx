import { ExternalLink } from "lucide-react";
import { chip } from "@/components/job-details/chip";
import { Meters } from "@/components/job-details/meters";
import { ScoreFit } from "@/components/job-details/score-fit";
import { EditableDate, EditableText } from "@/components/job-page/editable";
import { NARROW, SCROLL } from "@/components/job-page/track";
import { RemoteDaysField } from "@/components/remote-days-field";
import { StripHead } from "@/components/strip";
import { Button } from "@/components/ui/button";
import {
	columnOf,
	deadlineRead,
	type Job,
	type JobChanges,
	laneOf,
	locationOf,
	OUTCOME_GROUPS,
	OUTCOMES_BY_GROUP,
	type OutcomeId,
	outcomeTags,
	postedAge,
	readableSalary,
} from "@/lib/jobs";
import { cn } from "@/lib/utils";

/**
 * What the posting says, and what `/rank` made of it.
 *
 * TWO KINDS OF TRUTH, TOLD APART BY WHETHER THEY MOVE. What the posting says is a fact
 * the owner can correct better than any scraper, so every one of those values is where
 * it gets corrected. What `/rank` concluded is the one thing they cannot reproduce by
 * hand - the score, the verdict, the four axes - and a board that lets you type over a
 * score is a board whose scores mean nothing. It reads, and only reads. The scraper's
 * own sentence reads for the same reason: it is `/scrape`'s, and the log is the owner's.
 *
 * The outcome block only exists under Rejected, because a live application has no
 * answer yet.
 */

const DEADLINE_INK = {
	soon: "text-[var(--lamp-mid-ink)] font-semibold",
	lapsed: "text-muted-foreground",
	far: "text-foreground",
} as const;

export function Record({
	job,
	ai,
	onSave,
	onOutcome,
	onClearOutcome,
}: {
	job: Job;
	/**
	 * Whether the assistant is set up. With it off there is no score, no verdict and no
	 * axes to read, and two empty plates where they were is worse than not having the
	 * block: the posting's own facts are the whole record then.
	 */
	ai: boolean;
	onSave: (changes: JobChanges) => void;
	onOutcome: (tag: OutcomeId) => void;
	onClearOutcome: () => void;
}) {
	const current = columnOf(job);
	const lane = laneOf(current);
	const scored = typeof job.rank_score === "number";
	const due = job.rank_deadline ? deadlineRead(job.rank_deadline) : null;
	const held = new Set(outcomeTags(job).map((tag) => tag.id));

	return (
		<div className={cn("group/edits flex flex-col gap-3", SCROLL, NARROW)}>
			{ai && (
				<section aria-label="Rank" className="flex flex-col gap-2">
					<ScoreFit job={job} scored={scored} lane={lane} />
					<Meters dims={job.rank_dimensions} />
				</section>
			)}

			<section aria-label="Posting" className="flex flex-col gap-2">
				<StripHead label="Posting" />
				<div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
					<EditableText
						label="Company"
						value={job.company}
						onSave={(company) => onSave({ company })}
					/>
					<EditableText
						label="Salary"
						value={job.salary ? readableSalary(job.salary) : undefined}
						numeric
						placeholder="12000-16000 B2B"
						onSave={(salary) => onSave({ salary })}
					/>
					<EditableText
						label="Location"
						value={locationOf(job) ?? undefined}
						wide
						multiline
						placeholder="City, hybrid 2 days/week"
						// Saved into `rank_location`, where a place belongs, whichever field
						// the reading came out of.
						onSave={(rank_location) => onSave({ rank_location })}
					/>

					{/* The slider, not a text field: the answer is one of five things every
					    time. Full width - six buttons need it. */}
					<div className="col-span-2">
						<RemoteDaysField
							id="page-mode"
							value={job.work_mode ?? ""}
							onChange={(work_mode) => onSave({ work_mode })}
						/>
					</div>

					{/* Intake only, matching the card and the popover: once an application
					    is out, when applications closed cannot change anything. */}
					{lane === "intake" && (
						<div className="min-w-0">
							<p className="legend text-muted-foreground text-legend">
								Apply deadline
							</p>
							<EditableDate
								label="apply deadline"
								value={job.rank_deadline}
								look="line"
								onSave={(rank_deadline) => onSave({ rank_deadline })}
							/>
							{/* Only when it says something the date above does not. `far` reads
							    "due 08-20", which under the value "08-20" is the same date
							    twice; "due in 8d" and "lapsed" are readings. */}
							{due && due.state !== "far" && (
								<p
									className={cn(
										"font-data text-data tabular-nums",
										DEADLINE_INK[due.state],
									)}
								>
									{due.text}
								</p>
							)}
						</div>
					)}

					<EditableDate
						label="Posted"
						value={job.posted}
						onSave={(posted) => onSave({ posted })}
					/>
					<EditableDate
						label="First seen"
						value={job.first_seen}
						onSave={(first_seen) => onSave({ first_seen })}
					/>
					<EditableText
						label="Portal"
						value={job.portal}
						placeholder="manual (user)"
						onSave={(portal) => onSave({ portal })}
					/>

					{/* /scrape's and /rank's own sentence, not the owner's. The log is where
					    theirs goes, which is why this one only reads. */}
					{job.excluded_reason && (
						<div className="col-span-2 min-w-0">
							<p className="legend text-muted-foreground text-legend">
								Scraper note
							</p>
							<p className="text-muted-foreground mt-0.5 text-body text-pretty">
								{job.excluded_reason
									.replace(/—/g, "-")
									.replace(/^./, (c) => c.toUpperCase())}
							</p>
						</div>
					)}

					<div className="col-span-2 min-w-0">
						<p className="legend text-muted-foreground text-legend">Link</p>
						<EditableText
							label="posting URL"
							value={job.url}
							look="line"
							placeholder="https://…"
							onSave={(url) => onSave({ url })}
						/>
					</div>
				</div>

				{job.url && (
					<Button
						variant="outline"
						size="sm"
						nativeButton={false}
						render={
							<a href={job.url} target="_blank" rel="noreferrer noopener" />
						}
					>
						<ExternalLink className="size-3.5" />
						Open the posting
					</Button>
				)}
			</section>

			{/* How it ended, on the entries that have ended. Nothing ticked is the real
			    answer "they said no" rather than an unanswered prompt. */}
			{current === "rejected" && (
				<section aria-label="Outcome" className="flex flex-col gap-2">
					<StripHead
						label="Outcome"
						reading={
							held.size > 0 ? (
								<button
									type="button"
									onClick={onClearOutcome}
									className="text-muted-foreground hover:text-foreground text-meta font-medium transition-colors"
								>
									clear
								</button>
							) : (
								<span className="text-muted-foreground text-meta italic">
									they just said no
								</span>
							)
						}
					/>
					<div className="flex flex-col gap-2">
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
				</section>
			)}

			<p className="text-muted-foreground font-data text-data tabular-nums">
				Last updated{" "}
				{job.last_updated ? (
					postedAge(job.last_updated)
				) : (
					<>
						<span aria-hidden="true">-</span>
						<span className="sr-only">not recorded</span>
					</>
				)}
			</p>
		</div>
	);
}
