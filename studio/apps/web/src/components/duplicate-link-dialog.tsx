import { normalizeText } from "@jobsearch/jobs-data";
import { ExternalLink } from "lucide-react";
import { type RefObject, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { COLUMN_LABEL, columnOf, type Job, shortDate } from "@/lib/jobs";
import { cn } from "@/lib/utils";

/** Candidates shown before the filter has to narrow things. */
const LIMIT = 40;

type Props = {
	/** The entry being filed away, or null when the dialog is closed. */
	job: Job | null;
	onOpenChange: (open: boolean) => void;
	/** Everything on the board, including the entries currently hidden. */
	jobs: Job[];
	onConfirm: (key: string, canonicalKey: string) => void;
};

/**
 * Files one entry under another by hand, for what neither signal catches - a reworded
 * title, or a recruiter DM already on the board. Same-company entries come first,
 * being nearly always the answer.
 */
export function DuplicateLinkDialog({
	job,
	onOpenChange,
	jobs,
	onConfirm,
}: Props) {
	const field = useRef<HTMLInputElement>(null);

	return (
		<Dialog open={job !== null} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-xl" initialFocus={() => field.current}>
				<DialogHeader>
					<DialogTitle>Mark as a duplicate</DialogTitle>
					<DialogDescription>
						{job && (
							<>
								#{job.id ?? "?"} - {job.company || "(no company)"},{" "}
								{job.title?.replace(/\s+/g, " ").trim() || "untitled"}. Pick the
								entry it is a copy of; this one leaves the board and its
								`duplicate_of` points there. Its status and notes stay put.
							</>
						)}
					</DialogDescription>
				</DialogHeader>

				{/*
				 * Mounted only while open - `job` is the open signal - so the filter is
				 * per-open and reopening starts from the full list. No key: the entry
				 * cannot change without the dialog closing first.
				 */}
				<DuplicatePicker
					job={job}
					jobs={jobs}
					field={field}
					onConfirm={onConfirm}
					onOpenChange={onOpenChange}
				/>
			</DialogContent>
		</Dialog>
	);
}

type PickerProps = {
	job: Job | null;
	jobs: Job[];
	field: RefObject<HTMLInputElement | null>;
	onConfirm: (key: string, canonicalKey: string) => void;
	onOpenChange: (open: boolean) => void;
};

/** The filter, the shortlist it narrows, and the count under it. */
function DuplicatePicker({
	job,
	jobs,
	field,
	onConfirm,
	onOpenChange,
}: PickerProps) {
	const [query, setQuery] = useState("");

	const candidates = useMemo(() => {
		if (!job) return [];
		const company = normalizeText(job.company);
		const q = query.trim().toLowerCase();
		return jobs
			.filter((other) => {
				if (other.key === job.key) return false;
				// A copy cannot hold copies - it would resolve to its own canonical anyway,
				// so offer that instead.
				if (typeof other.duplicate_of === "string") return false;
				if (!q) return true;
				return `${other.company ?? ""} ${other.title ?? ""} #${other.id ?? ""}`
					.toLowerCase()
					.includes(q);
			})
			.sort(
				(a, b) =>
					Number(normalizeText(b.company) === company) -
						Number(normalizeText(a.company) === company) ||
					(a.company ?? "").localeCompare(b.company ?? "") ||
					(a.id ?? 0) - (b.id ?? 0),
			)
			.slice(0, LIMIT);
	}, [job, jobs, query]);

	return (
		<>
			<Input
				ref={field}
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				placeholder="Company, title or id…"
			/>

			<div className="-mx-1 max-h-[min(22rem,45dvh)] space-y-1.5 overflow-y-auto px-1">
				{candidates.map((other) => (
					<button
						key={other.key}
						type="button"
						onClick={() => {
							if (job) onConfirm(job.key, other.key);
							onOpenChange(false);
						}}
						className={cn(
							"border border-border bg-card hover:border-border-strong hover:bg-card-hover flex w-full items-center gap-2 rounded-key px-2.5 py-2 text-left transition-[border-color,background-color]",
							"focus-visible:outline-signal focus-visible:outline-2 focus-visible:outline-offset-1",
						)}
					>
						<span className="text-muted-foreground shrink-0 font-data text-data font-semibold tabular-nums">
							#{other.id ?? "?"}
						</span>
						<span className="min-w-0 flex-1">
							<span className="block truncate text-body font-medium">
								{other.title?.replace(/\s+/g, " ").trim() || "(untitled)"}
							</span>
							<span className="text-muted-foreground block truncate text-meta">
								{other.company || "(no company)"}
								{" · "}
								{other.portal?.replace(/-search/g, "") ?? "?"}
								{" · "}
								{COLUMN_LABEL[columnOf(other)]}
								{other.first_seen && ` · ${shortDate(other.first_seen)}`}
							</span>
						</span>
						{other.url && (
							<span
								// A nested anchor would swallow the row's click; reuse its handler.
								role="presentation"
								className="text-muted-foreground shrink-0"
								onClick={(e) => {
									e.stopPropagation();
									window.open(other.url, "_blank", "noreferrer,noopener");
								}}
							>
								<ExternalLink className="size-3.5" />
							</span>
						)}
					</button>
				))}
				{candidates.length === 0 && (
					<p className="label text-muted-foreground py-6 text-center text-legend">
						nothing matches
					</p>
				)}
			</div>

			<DialogFooter>
				<span className="text-muted-foreground mr-auto self-center font-data text-data tabular-nums">
					{candidates.length === LIMIT
						? `first ${LIMIT} - narrow the filter`
						: `${candidates.length} shown`}
				</span>
				<Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
					Cancel
				</Button>
			</DialogFooter>
		</>
	);
}
