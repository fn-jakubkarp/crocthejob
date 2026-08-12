import { ArrowLeft, ExternalLink, FilePlus } from "lucide-react";
import { useState } from "react";
import { Actions } from "@/components/job-page/actions";
import { Artifacts } from "@/components/job-page/artifacts";
import { DocModal, type Reading } from "@/components/job-page/doc-modal";
import { EditableText } from "@/components/job-page/editable";
import { JourneyLog } from "@/components/job-page/log";
import { StageRail } from "@/components/job-page/rail";
import { Record } from "@/components/job-page/record";
import { RunPanel } from "@/components/job-page/run-panel";
import { NARROW, NARROW_FORM, TRACK } from "@/components/job-page/track";
import { SavePostingDialog } from "@/components/save-posting-dialog";
import { Button } from "@/components/ui/button";
import type { Run } from "@/hooks/use-run";
import { useSetup } from "@/hooks/use-setup";
import { externalLink } from "@/lib/external-link";
import {
	type CommandId,
	type Job,
	type JobChanges,
	type OutcomeId,
	type Status,
	stageOf,
} from "@/lib/jobs";
import { cn } from "@/lib/utils";

/**
 * THESIS: one application, answered in one viewport - where it stands, how long each step
 * took, what happened, what is written, all editable in place. It refuses the tracker's
 * detail page: a job description set as the page body, with the process buried under it
 * and every correction behind a dialog.
 * OWN-WORLD: the board's own plate - one hue at very low chroma, derived light and dark,
 * elevation by lightness step and hairline - with Archivo condensed uppercase labels and
 * Geist numerals; the timeline's nine event colours carry the pipeline, and the chevron
 * rail is the one form built for this page.
 * STORY: this is live, it has waited this long, here is what was said, here is what to do
 * next.
 * FIRST VIEWPORT: the chevron rail full width with the days between stages in its joints;
 * under it three tracks that scroll in themselves, never the page - the record left, the
 * log centre, the documents and the skills right.
 * FORM: rail-masthead over a three-track instrument. It replaces a reading-left,
 * rail-right page whose left column was the description: the JD is 3,000 words, and set in
 * the page it *was* the page.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
 * review, the verdict, and DESIGN.md.
 */

type Props = {
	job: Job;
	onBack: () => void;
	onStatus: (status: Status) => void;
	onNotes: (notes: string) => Promise<void>;
	onPatch: (changes: JobChanges) => void;
	/** A field corrected in place. Same path as the dialog, so a re-key is followed. */
	onSaveEdits: (changes: JobChanges) => void;
	onOutcome: (tag: OutcomeId) => void;
	onClearOutcome: () => void;
	/** A JD typed in by hand. Rethrows, so the dialog can stay open. */
	onSavePosting: (key: string, text: string) => Promise<void>;
	/** The skill run in flight, whichever entry it belongs to. */
	run: Run;
};

export function JobPage({
	job,
	onBack,
	onStatus,
	onNotes,
	onPatch,
	onSaveEdits,
	onOutcome,
	onClearOutcome,
	onSavePosting,
	run,
}: Props) {
	const [addingPosting, setAddingPosting] = useState(false);
	const [reading, setReading] = useState<Reading | null>(null);
	const { setup } = useSetup();
	const stage = stageOf(job);
	/**
	 * Every control that writes this entry stands down while a skill is writing it, in one
	 * native attribute rather than a `busy` prop threaded through six components. The
	 * readings stay readable, and the run's own Stop and reply box stay outside it.
	 */
	const busy = run.busy;

	return (
		<main className="flex min-h-0 flex-1 flex-col gap-3 p-3 pl-[4.5rem]">
			<header className="group/edits flex items-start gap-3">
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label="Back to the board"
					onClick={onBack}
					className="mt-0.5 shrink-0"
				>
					<ArrowLeft />
				</Button>

				{/* The id sits in the heading rather than on a line above it: an eyebrow over
				    a title is a label the title does not need, and the stage word that used
				    to sit beside it is stated in colour by the rail forty pixels below. */}
				<div className="flex min-w-0 flex-1 items-baseline gap-2.5">
					<span className="text-muted-foreground shrink-0 pt-1 font-data text-meta tabular-nums">
						{job.id ? `#${job.id}` : "no id"}
					</span>
					<fieldset disabled={busy} className="min-w-0 flex-1">
						<EditableText
							label="title"
							value={job.title?.replace(/\s+/g, " ").trim()}
							look="line"
							multiline
							placeholder="(untitled)"
							textClassName="text-readout leading-[1.15] font-[620] tracking-[-0.02em] text-balance"
							onSave={(title) => onSaveEdits({ title })}
						/>
					</fieldset>
				</div>

				{job.url && (
					<Button
						variant="outline"
						size="sm"
						className="mt-0.5 shrink-0"
						{...externalLink(job.url)}
					>
						<ExternalLink className="size-3.5" />
						Posting
					</Button>
				)}
			</header>

			<fieldset disabled={busy} className="min-w-0">
				<StageRail job={job} onStatus={onStatus} />
			</fieldset>

			{/*
			 * Three tracks, each scrolling in itself so the page never does - the board's own
			 * topology, at one entry's scale. Below 1101px there is no room to keep that
			 * promise, so it becomes one column and the page scrolls: the record, the log,
			 * then the documents, in the order the questions come.
			 */}
			<div className="grid min-h-0 flex-1 gap-3 max-[1100px]:auto-rows-min max-[1100px]:grid-cols-1 max-[1100px]:overflow-y-auto min-[1101px]:grid-cols-[19rem_minmax(0,1fr)_21rem]">
				<div className={cn(TRACK, NARROW_FORM)}>
					<fieldset disabled={busy} className="flex min-h-0 min-w-0 flex-col">
						<Record
							job={job}
							ai={setup.ai}
							onSave={onSaveEdits}
							onOutcome={onOutcome}
							onClearOutcome={onClearOutcome}
						/>
					</fieldset>
				</div>

				<div className={TRACK}>
					{/* Only this entry's run: opening another posting mid-run leaves the
					    working where it belongs. It sits in the wide track because a
					    transcript needs width the rail does not have, and outside the
					    fieldset because Stop and the reply box have to keep working. */}
					{run.jobId === job.id && (
						<div className="mb-3 shrink-0">
							<RunPanel run={run} />
						</div>
					)}
					<fieldset disabled={busy} className="flex min-h-0 min-w-0 flex-col">
						<JourneyLog job={job} onNotes={onNotes} onPatch={onPatch} />
					</fieldset>
				</div>

				<div className={cn(TRACK, NARROW, "gap-3")}>
					<Artifacts
						dir={job.application_dir}
						posting={job.posting_file}
						onOpen={(path, title) => setReading({ path, title })}
					/>

					<fieldset disabled={busy} className="flex min-w-0 flex-col gap-3">
						{/* The description is the one document the board can write itself, and
						    the offer only exists while there is nothing to read: once it is
						    saved it is a row in the list above, and a dimmed button saying so
						    reads as a fifth document that failed. */}
						{!job.posting_file && (
							<Button
								variant="outline"
								size="sm"
								className="justify-start"
								onClick={() => setAddingPosting(true)}
							>
								<FilePlus className="size-3.5" />
								Paste the description
							</Button>
						)}

						{setup.ai && job.id !== undefined && (
							<Actions
								job={job}
								busy={busy}
								onRun={(command: CommandId) =>
									run.start(
										job.id as number,
										command,
										command === "interview" ? stage : undefined,
									)
								}
							/>
						)}
					</fieldset>
				</div>
			</div>

			<SavePostingDialog
				job={job}
				open={addingPosting}
				onOpenChange={setAddingPosting}
				onConfirm={onSavePosting}
			/>

			<DocModal reading={reading} onClose={() => setReading(null)} />
		</main>
	);
}
