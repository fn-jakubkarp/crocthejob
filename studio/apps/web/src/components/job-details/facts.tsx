import { Field } from "@/components/field";
import { Groove } from "@/components/job-details/groove";
import {
	deadlineRead,
	type Job,
	type Lane,
	locationOf,
	postedAge,
	readableMode,
	readableSalary,
} from "@/lib/jobs";
import { cn } from "@/lib/utils";

export /**
 * Every field, every time, in this order: a missing one reads "-" rather than closing
 * the gap, so a value is always on the same line. Exception is `bare` - an entry
 * /rank never touched, where nearly every field would be a dash, so only what exists
 * is shown and an entry with nothing at all drops the block.
 *
 * No `first_seen`/`portal` - scraper bookkeeping; both are in the dialog and on the
 * duplicate rows, which is where they tell copies apart.
 */
function Facts({ job, bare, lane }: { job: Job; bare: boolean; lane?: Lane }) {
	// The card drops the deadline once applied; here it stays readable at every stage.
	const due = job.rank_deadline ? deadlineRead(job.rank_deadline) : null;
	// All fields omitted leaves the grid and its rule as a gap with a line through it.
	const any =
		!bare ||
		[
			readableMode(job.work_mode),
			job.salary,
			locationOf(job),
			due,
			job.posted,
			job.excluded_reason,
		].some(Boolean);
	if (!any) return null;

	return (
		<>
			<Groove />
			<div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
				<Field label="Work mode" omitEmpty={bare}>
					{readableMode(job.work_mode)}
				</Field>
				<Field label="Salary" numeric omitEmpty={bare}>
					{job.salary && readableSalary(job.salary)}
				</Field>
				<Field label="Location" wide wrap omitEmpty={bare}>
					{locationOf(job)}
				</Field>
				{lane !== "intake" && (
					<Field label="Applied" numeric>
						{job.applied_date}
					</Field>
				)}
				{/* Only while triaging: once applied, a closed-applications date cannot
				    change anything, and next to a live process it reads as bad news. */}
				{lane === "intake" && (
					<Field label="Apply deadline" numeric omitEmpty={bare}>
						{due && (
							<span
								className={cn(
									due.state === "soon" &&
										"text-[var(--lamp-mid-ink)] font-semibold",
									due.state === "lapsed" && "text-muted-foreground",
								)}
							>
								{due.text}
							</span>
						)}
					</Field>
				)}
				<Field label="Posted" numeric omitEmpty={bare}>
					{job.posted ? postedAge(job.posted) : undefined}
				</Field>
				{/* /scrape's and /rank's own sentence. Yours goes in Notes, hence not
				    editable here. */}
				<Field label="Scraper note" wide wrap omitEmpty={bare}>
					{job.excluded_reason
						?.replace(/—/g, "-")
						.replace(/^./, (c) => c.toUpperCase())}
				</Field>
			</div>
		</>
	);
}
