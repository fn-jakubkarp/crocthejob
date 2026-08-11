import { type RefObject, useRef, useState } from "react";
import { RemoteDaysField } from "@/components/remote-days-field";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	COLUMN_LABEL,
	COLUMNS,
	columnOf,
	type Job,
	type JobChanges,
	locationOf,
	type NewJob,
	type Status,
} from "@/lib/jobs";

/**
 * What the board lets you correct by hand. No `fit` or `rank_*` score - /scrape's and
 * /rank's judgements; `rank_location` is the exception, being a place. Keep in step
 * with JobChanges in src/lib/jobs.ts.
 */
type Draft = {
	company: string;
	title: string;
	url: string;
	work_mode: string;
	salary: string;
	rank_location: string;
	applied_date: string;
	rank_deadline: string;
	posted: string;
	first_seen: string;
	portal: string;
	status: Status;
	notes: string;
	excluded_reason: string;
};

const EMPTY: Draft = {
	company: "",
	title: "",
	url: "",
	work_mode: "",
	salary: "",
	rank_location: "",
	applied_date: "",
	rank_deadline: "",
	posted: "",
	first_seen: "",
	portal: "",
	status: "new",
	notes: "",
	excluded_reason: "",
};

const draftOf = (job: Job): Draft => ({
	company: job.company ?? "",
	title: job.title?.replace(/\s+/g, " ").trim() ?? "",
	url: job.url ?? "",
	work_mode: job.work_mode ?? "",
	salary: job.salary ?? "",
	// Whatever the panel shows, so an office list lifted out of `work_mode` is edited
	// rather than retyped. Saving moves it into `rank_location`, where a place belongs.
	rank_location: locationOf(job) ?? "",
	applied_date: job.applied_date ?? "",
	rank_deadline: job.rank_deadline ?? "",
	posted: job.posted ?? "",
	first_seen: job.first_seen ?? "",
	portal: job.portal ?? "",
	status: columnOf(job),
	notes: job.notes ?? "",
	excluded_reason: job.excluded_reason ?? "",
});

/** Ceiling on a date that has already happened. */
const todayISO = () => new Date().toISOString().slice(0, 10);

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The entry being edited, or null to add one. */
	job: Job | null;
	/** Which field to land the cursor on instead of the first one. */
	focusField?: "url" | null;
	/** Rejects with the server's reason. */
	onCreate: (draft: NewJob) => Promise<void>;
	/** Only the fields that changed. */
	onSave: (key: string, changes: JobChanges) => Promise<void>;
};

/**
 * Add a posting the scrapers missed, or correct one on the board - the only place any
 * of it is editable; the details popover reads.
 *
 * No `fit` or score field: /scrape's and /rank's conclusions, so a hand-added entry
 * carries none until /rank reads it. No notes when editing either - the popover owns
 * them and autosaves, so a second copy here could overwrite what was typed there.
 */
export function JobFormDialog({
	open,
	onOpenChange,
	job,
	focusField,
	onCreate,
	onSave,
}: Props) {
	const editing = job !== null;
	const first = useRef<HTMLInputElement>(null);
	const url = useRef<HTMLInputElement>(null);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="sm:max-w-lg"
				// A resolver, not the refs directly: read at open time, after the field
				// `focusField` names has mounted.
				initialFocus={() =>
					focusField === "url" ? url.current : first.current
				}
			>
				<DialogHeader>
					<DialogTitle>
						{editing ? "Edit posting" : "Add a posting"}
						{editing && job.id && (
							<span className="text-muted-foreground font-data ml-1.5 font-normal tabular-nums">
								#{job.id}
							</span>
						)}
					</DialogTitle>
				</DialogHeader>

				{/*
				 * Mounted only while open, so the draft is per-open: reopening starts from
				 * what is stored, not from what was abandoned. Keyed by the entry as well,
				 * so Add and Edit never inherit each other's fields.
				 */}
				<JobForm
					key={job?.key ?? "new"}
					job={job}
					editing={editing}
					first={first}
					url={url}
					onCreate={onCreate}
					onSave={onSave}
					onOpenChange={onOpenChange}
				/>
			</DialogContent>
		</Dialog>
	);
}

type FormProps = {
	job: Job | null;
	editing: boolean;
	first: RefObject<HTMLInputElement | null>;
	url: RefObject<HTMLInputElement | null>;
	onCreate: (draft: NewJob) => Promise<void>;
	onSave: (key: string, changes: JobChanges) => Promise<void>;
	onOpenChange: (open: boolean) => void;
};

/** The fields being edited, and the button that commits them. */
function JobForm({
	job,
	editing,
	first,
	url,
	onCreate,
	onSave,
	onOpenChange,
}: FormProps) {
	const [draft, setDraft] = useState<Draft>(() => (job ? draftOf(job) : EMPTY));
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const set = <K extends keyof Draft>(field: K, value: Draft[K]) =>
		setDraft((prev) => ({ ...prev, [field]: value }));

	const ready = draft.title.trim() !== "" && draft.company.trim() !== "";
	// Still being triaged, i.e. whether an apply deadline is worth showing.
	const intake =
		COLUMNS.find((c) => c.status === draft.status)?.lane === "intake";

	/** Only what moved, so an untouched status never restamps `status_date`. */
	const changes = (): JobChanges => {
		if (!job) return {};
		const was = draftOf(job);
		const out: JobChanges = {};
		if (draft.company.trim() !== was.company) out.company = draft.company;
		if (draft.title.trim() !== was.title) out.title = draft.title;
		if (draft.url.trim() !== was.url) out.url = draft.url;
		if (draft.work_mode !== was.work_mode) out.work_mode = draft.work_mode;
		if (draft.salary.trim() !== was.salary) out.salary = draft.salary;
		if (draft.rank_location.trim() !== was.rank_location) {
			out.rank_location = draft.rank_location;
		}
		if (draft.excluded_reason.trim() !== was.excluded_reason) {
			out.excluded_reason = draft.excluded_reason;
		}
		if (draft.portal.trim() !== was.portal) out.portal = draft.portal;
		for (const field of [
			"applied_date",
			"rank_deadline",
			"posted",
			"first_seen",
		] as const) {
			if (draft[field] !== was[field]) out[field] = draft[field];
		}
		if (draft.status !== was.status) out.status = draft.status;
		return out;
	};

	const submit = async () => {
		if (!ready || busy) return;
		setBusy(true);
		setError(null);
		try {
			if (job) {
				const edit = changes();
				if (Object.keys(edit).length > 0) await onSave(job.key, edit);
			} else {
				await onCreate({
					title: draft.title,
					company: draft.company,
					url: draft.url,
					work_mode: draft.work_mode,
					salary: draft.salary,
					applied_date: draft.applied_date,
					notes: draft.notes,
					status: draft.status,
				});
			}
			onOpenChange(false);
		} catch (e) {
			// Stays open with the text intact. Likely: a 409 for a posting already on the
			// board, or a rejected URL.
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	};

	return (
		<>
			<div className="grid gap-3">
				<div className="grid grid-cols-2 gap-3">
					<div className="grid gap-1.5">
						<Label htmlFor="job-company">Company</Label>
						<Input
							id="job-company"
							ref={first}
							value={draft.company}
							onChange={(e) => set("company", e.target.value)}
							placeholder="Acme"
						/>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="job-title">Title</Label>
						<Input
							id="job-title"
							value={draft.title}
							onChange={(e) => set("title", e.target.value)}
							placeholder="QA Engineer"
						/>
					</div>
				</div>

				<div className="grid gap-1.5">
					<Label htmlFor="job-url">Posting URL</Label>
					<Input
						id="job-url"
						ref={url}
						value={draft.url}
						onChange={(e) => set("url", e.target.value)}
						placeholder="https://…"
					/>
				</div>

				{/* Full row: six buttons across 480px is ~75px each; at half width, under
				    40px. Renders its own label. */}
				<RemoteDaysField
					id="job-mode"
					value={draft.work_mode}
					onChange={(v) => set("work_mode", v)}
				/>

				<div className="grid grid-cols-2 gap-3">
					<div className="grid gap-1.5">
						<Label htmlFor="job-salary">Salary</Label>
						<Input
							id="job-salary"
							value={draft.salary}
							onChange={(e) => set("salary", e.target.value)}
							placeholder="12000-16000 PLN net B2B"
						/>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="job-location">Location</Label>
						<Input
							id="job-location"
							value={draft.rank_location}
							onChange={(e) => set("rank_location", e.target.value)}
							placeholder="City, hybrid 2 days/week"
						/>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-3">
					<div className="grid gap-1.5">
						<Label htmlFor="job-applied">Applied</Label>
						{/* A real date input, so it can be backdated - `status_date` only ever
						    says today. */}
						<Input
							id="job-applied"
							type="date"
							value={draft.applied_date}
							max={todayISO()}
							onChange={(e) => set("applied_date", e.target.value)}
							className="font-data tabular-nums"
						/>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="job-status">Stage</Label>
						<Select
							value={draft.status}
							onValueChange={(v) => set("status", (v as Status) ?? "new")}
						>
							<SelectTrigger id="job-status" className="w-full">
								{/* base-ui renders the raw value by default; map it to the label. */}
								<SelectValue>
									{(v) => COLUMN_LABEL[v as Status] ?? String(v)}
								</SelectValue>
							</SelectTrigger>
							{/* base-ui's `alignItemWithTrigger` overlays the popup and slides it
							    sideways, past the dialog edge on a 480px trigger. Anchor below. */}
							<SelectContent alignItemWithTrigger={false} align="start">
								{COLUMNS.map((col) => (
									<SelectItem key={col.status} value={col.status}>
										{col.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-3">
					{/* Only while triaging, matching the panel. `intake` reads the *draft*
					    stage, so moving the entry on here takes the field with it. */}
					{intake && (
						<div className="grid gap-1.5">
							<Label htmlFor="job-deadline">Apply deadline</Label>
							<Input
								id="job-deadline"
								type="date"
								value={draft.rank_deadline}
								onChange={(e) => set("rank_deadline", e.target.value)}
								className="font-data tabular-nums"
							/>
						</div>
					)}
					<div className="grid gap-1.5">
						<Label htmlFor="job-posted">Posted</Label>
						<Input
							id="job-posted"
							type="date"
							value={draft.posted}
							max={todayISO()}
							onChange={(e) => set("posted", e.target.value)}
							className="font-data tabular-nums"
						/>
					</div>
					{editing && (
						<div className="grid gap-1.5">
							<Label htmlFor="job-first-seen">First seen</Label>
							<Input
								id="job-first-seen"
								type="date"
								value={draft.first_seen}
								max={todayISO()}
								onChange={(e) => set("first_seen", e.target.value)}
								className="font-data tabular-nums"
							/>
						</div>
					)}
					{editing && (
						<div className="grid gap-1.5">
							<Label htmlFor="job-portal">Portal</Label>
							<Input
								id="job-portal"
								value={draft.portal}
								onChange={(e) => set("portal", e.target.value)}
								placeholder="manual (user)"
							/>
						</div>
					)}
				</div>

				{!editing && (
					<div className="grid gap-1.5">
						<Label htmlFor="job-notes">Notes</Label>
						<Textarea
							id="job-notes"
							value={draft.notes}
							onChange={(e) => set("notes", e.target.value)}
							rows={2}
							placeholder="Recruiter name, where it came from, what was said."
							className="resize-none"
						/>
					</div>
				)}

				{editing && (
					<div className="grid gap-1.5">
						<Label htmlFor="job-excluded-reason">Scraper note</Label>
						<Textarea
							id="job-excluded-reason"
							value={draft.excluded_reason}
							onChange={(e) => set("excluded_reason", e.target.value)}
							rows={2}
							placeholder="System reason or automated message"
							className="resize-none text-body leading-[1.5]"
						/>
					</div>
				)}

				{error && (
					<p className="text-destructive text-meta" role="alert">
						{error}
					</p>
				)}
			</div>

			<DialogFooter>
				<Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
					Cancel
				</Button>
				<Button
					size="sm"
					disabled={!ready || busy}
					onClick={() => void submit()}
				>
					{busy
						? editing
							? "Saving…"
							: "Adding…"
						: editing
							? "Save changes"
							: "Add posting"}
				</Button>
			</DialogFooter>
		</>
	);
}
