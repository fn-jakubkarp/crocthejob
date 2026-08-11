import { Facts } from "@/components/job-details/facts";
import { Groove } from "@/components/job-details/groove";
import { Heading } from "@/components/job-details/heading";
import { Links } from "@/components/job-details/links";
import { Meters } from "@/components/job-details/meters";
import { Notes } from "@/components/job-details/notes";
import { Outcome } from "@/components/job-details/outcome";
import { ScoreFit } from "@/components/job-details/score-fit";
import { Stage } from "@/components/job-details/stage";
import {
	COLUMNS,
	columnOf,
	type DupCopy,
	type Job,
	type JobChanges,
	type OutcomeId,
	postedAge,
	type Status,
} from "@/lib/jobs";

type Props = {
	job: Job;
	/** Set when this entry is filed under another one. */
	copy?: DupCopy;
	copies?: DupCopy[];
	onStatus: (status: Status) => void;
	onNotes: (notes: string) => Promise<void>;
	onEdit: (focus?: "url") => void;
	/** Opens `posting_file` in the document reader. */
	onReadPosting: () => void;
	/** Opens the dialog that saves a hand-typed JD for an entry with none. */
	onAddPosting: () => void;
	onUnlinkDuplicate: (key: string) => void;
	onOutcome: (tag: OutcomeId) => void;
	onClearOutcome: () => void;
	onPatch: (changes: JobChanges) => void;
};

export function JobDetails({
	job,
	copy,
	copies,
	onStatus,
	onNotes,
	onEdit,
	onReadPosting,
	onAddPosting,
	onUnlinkDuplicate,
	onOutcome,
	onClearOutcome,
	onPatch,
}: Props) {
	const current = columnOf(job);
	const lane = COLUMNS.find((c) => c.status === current)?.lane;
	const scored = typeof job.rank_score === "number";
	// Untouched by /rank: nearly every field in the grid below would be a dash, so the
	// fixed frame is dropped and only what exists is shown.
	const bare = !scored && lane === "intake";

	const summary = (
		<>
			<ScoreFit job={job} scored={scored} lane={lane} />
			<Meters dims={job.rank_dimensions} />
			<Facts job={job} bare={bare} lane={lane} />
			<Links
				job={job}
				copy={copy}
				copies={copies}
				onUnlinkDuplicate={onUnlinkDuplicate}
				onReadPosting={onReadPosting}
				onAddPosting={onAddPosting}
				onEditUrl={() => onEdit("url")}
			/>
		</>
	);

	const working = (
		<>
			<Stage
				job={job}
				current={current}
				lane={lane}
				onStatus={onStatus}
				onPatch={onPatch}
			/>
			<Notes job={job} onNotes={onNotes} />
		</>
	);

	// Under Rejected the answer leads - that is what a dead entry is opened to read.
	// Elsewhere the details lead, because the question is still whether to apply.
	return (
		<div className="space-y-3.5">
			<Heading job={job} copy={copy} onEdit={onEdit} />
			{current === "rejected" ? (
				<>
					<Outcome
						job={job}
						onOutcome={onOutcome}
						onClearOutcome={onClearOutcome}
					/>
					{working}
					<Groove />
					{summary}
				</>
			) : (
				<>
					{summary}
					<Groove />
					{working}
				</>
			)}

			{/* The panel's own bookkeeping, closing it the way the id opens it. Not a fact
			    about the posting, so it stays out of the grid above. Kept on entries that
			    have none - a panel that drops the line is a different panel per card. */}
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
