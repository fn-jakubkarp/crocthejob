import { chip } from "@/components/job-details/chip";
import { DatePicker } from "@/components/ui/date-picker";
import {
	COLUMNS,
	type Job,
	type JobChanges,
	type Lane,
	type Status,
} from "@/lib/jobs";

/** Stage dates the panel can rewrite, and the field each lives in. */
const STAGE_DATES = [
	{ id: "applied", label: "Applied", field: "applied_date" },
	{ id: "screening", label: "Screening", field: "screening_date" },
	{ id: "tech_interview", label: "Tech", field: "tech_interview_date" },
	{ id: "final_round", label: "Final round", field: "final_round_date" },
	{ id: "offer", label: "Offer", field: "offer_date" },
] as const satisfies readonly {
	id: Status;
	label: string;
	field: keyof JobChanges & keyof Job;
}[];

/** Process order, for telling a passed stage from one still ahead. */
const STAGE_ORDER: Status[] = [
	"new",
	"ranked",
	"applied",
	"screening",
	"tech_interview",
	"final_round",
	"offer",
	"rejected",
	"skipped",
];

export /** Where the entry sits in the pipeline, and the dates it collected getting there. */
function Stage({
	job,
	current,
	lane,
	onStatus,
	onPatch,
}: {
	job: Job;
	current: Status;
	lane?: Lane;
	onStatus: (status: Status) => void;
	onPatch: (changes: JobChanges) => void;
}) {
	return (
		<div>
			<p className="label text-muted-foreground mb-2 text-data">Stage</p>
			<div className="flex flex-wrap gap-1.5">
				{COLUMNS.map((col) => (
					<button
						key={col.status}
						type="button"
						onClick={() => onStatus(col.status)}
						aria-current={col.status === current}
						className={chip(col.status === current)}
					>
						{col.label}
					</button>
				))}
			</div>
			{lane !== "intake" && (
				<div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
					{STAGE_DATES.map(({ id, label, field }) => {
						const stored = job[field];
						const value = typeof stored === "string" ? stored : "";
						const hasValue = Boolean(value);
						const ahead =
							STAGE_ORDER.indexOf(current) < STAGE_ORDER.indexOf(id);

						// Closed: only the dates it carries. Live: also the current stage and
						// every one behind it, so a forgotten date can still be filled in.
						if (current === "rejected" || current === "skipped") {
							if (!hasValue) return null;
						} else if (!hasValue && ahead) return null;

						return (
							<div
								key={id}
								className="flex flex-col gap-1 w-full max-w-[200px]"
							>
								{/* `<span>`, not `<label>`: the picker's control is a button, which
								    a label cannot target, so the name goes on the picker. */}
								<span className="text-muted-foreground text-meta">{label}</span>
								<DatePicker
									value={value}
									aria-label={`${label} date`}
									// A computed key widens to `{ [x: string]: string }`, hence the cast.
									onChange={(val) => onPatch({ [field]: val } as JobChanges)}
									className="h-8 w-full text-xs px-2 py-1"
								/>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
