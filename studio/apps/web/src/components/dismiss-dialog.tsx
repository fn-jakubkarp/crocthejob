import { type RefObject, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { Job } from "@/lib/jobs";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Writes `status: skipped` and the reason into `notes` in one PATCH. */
	onConfirm: (reason: string) => void;
	/** One card's entry, or the size of a selection. Exactly one of the two. */
	job?: Job;
	count?: number;
};

/**
 * Ruling postings out by hand. The reason is required and goes into `notes`, not
 * `excluded_reason`, which /scrape and /rank own. Dragging into Skipped is the
 * no-reason path. A batch writes the same sentence to every entry.
 */
export function DismissDialog({
	open,
	onOpenChange,
	onConfirm,
	job,
	count,
}: Props) {
	const batch = typeof count === "number" && count > 1;
	const area = useRef<HTMLTextAreaElement>(null);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="sm:max-w-md"
				// A resolver, not the ref, so the element type stays HTMLTextAreaElement.
				initialFocus={() => area.current}
			>
				<DialogHeader>
					<DialogTitle>
						{batch ? `Skip ${count} postings` : "Skip this posting"}
					</DialogTitle>
					<DialogDescription>
						{batch ? (
							<>
								The same reason is written to all {count}, and each one moves to
								Skipped. Anything already in their notes is replaced.
							</>
						) : (
							<>
								{job?.company ?? "This posting"} -{" "}
								{job?.title?.replace(/\s+/g, " ").trim() || "untitled"}
								{typeof job?.rank_score === "number" && (
									<>
										{". Scored "}
										<span className="text-foreground font-data tabular-nums">
											{job.rank_score}
										</span>
										{job.rank_verdict ? ` (${job.rank_verdict})` : ""}, so say
										what the score missed.
									</>
								)}
							</>
						)}
					</DialogDescription>
				</DialogHeader>

				{/*
				 * Mounted only while open, so the draft is per-open: reopening starts from
				 * what is stored, not from what was abandoned. Keyed by the entry as well,
				 * so a card swapped in underneath does not inherit the other one's draft.
				 */}
				<DismissDraft
					key={job?.key ?? "batch"}
					// One card starts from its own note; a batch starts empty, or one
					// member's note would be written across the rest.
					stored={batch ? "" : (job?.notes ?? "")}
					batch={batch}
					count={count}
					area={area}
					onConfirm={onConfirm}
					onOpenChange={onOpenChange}
				/>
			</DialogContent>
		</Dialog>
	);
}

type DraftProps = {
	stored: string;
	batch: boolean;
	count?: number;
	area: RefObject<HTMLTextAreaElement | null>;
	onConfirm: (reason: string) => void;
	onOpenChange: (open: boolean) => void;
};

/** The reason being typed, and the button that commits it. */
function DismissDraft({
	stored,
	batch,
	count,
	area,
	onConfirm,
	onOpenChange,
}: DraftProps) {
	const [reason, setReason] = useState(stored);
	const ready = reason.trim().length > 0;

	const confirm = () => {
		if (!ready) return;
		onConfirm(reason.trim());
		onOpenChange(false);
	};

	return (
		<>
			<Textarea
				ref={area}
				value={reason}
				onChange={(e) => setReason(e.target.value)}
				// Ctrl/Cmd+Enter submits; plain Enter stays a newline.
				onKeyDown={(e) => {
					if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
						e.preventDefault();
						confirm();
					}
				}}
				rows={4}
				placeholder="Mid-level title, senior scope. Or: on-site four days, relocation."
				className="resize-none"
			/>

			<DialogFooter>
				<Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
					Cancel
				</Button>
				<Button
					variant="destructive"
					size="sm"
					disabled={!ready}
					onClick={confirm}
				>
					{batch ? `Skip ${count}` : "Skip"}
				</Button>
			</DialogFooter>
		</>
	);
}
