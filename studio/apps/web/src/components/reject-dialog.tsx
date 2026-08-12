import { useEffect, useRef, useState } from "react";
import { chip } from "@/components/job-details/chip";
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
import {
	columnOf,
	type Job,
	OUTCOME_GROUPS,
	OUTCOMES_BY_GROUP,
	type OutcomeId,
	outcomeIds,
	outcomeTags,
} from "@/lib/jobs";
import { run, STATUS_HUE } from "@/lib/strip";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** One card's entry, or the size of a selection. Exactly one of the two. */
	job?: Job;
	count?: number;
	/** Tags, and the note only when it was actually changed. */
	onConfirm: (outcome: OutcomeId[], note?: string) => void;
};

/**
 * Asked on the way into Rejected: "rejected" alone says nothing, and a month later
 * nobody reconstructs *how* from a column. No tag is a real answer - they said no -
 * so the button is never blocked.
 */
export function RejectDialog({
	open,
	onOpenChange,
	job,
	count,
	onConfirm,
}: Props) {
	const batch = typeof count === "number" && count > 1;
	const [held, setHeld] = useState<Set<OutcomeId>>(new Set());
	const [note, setNote] = useState("");
	const area = useRef<HTMLTextAreaElement>(null);

	// One card starts from what it carries; a batch starts empty, or one member's tags
	// and note would be written across the rest.
	useEffect(() => {
		if (!open) return;
		setHeld(
			batch || !job ? new Set() : new Set(outcomeTags(job).map((t) => t.id)),
		);
		setNote(batch ? "" : (job?.notes ?? ""));
	}, [open, batch, job]);

	const toggle = (tag: OutcomeId) =>
		setHeld((prev) => {
			const next = new Set(prev);
			if (next.has(tag)) next.delete(tag);
			else next.add(tag);
			return next;
		});

	const confirm = () => {
		const outcome = outcomeIds(held);
		const stored = batch ? "" : (job?.notes ?? "");
		onConfirm(outcome, note.trim() === stored.trim() ? undefined : note.trim());
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{/* The move it is asking about, along the bottom edge: the stage the entry is
			    standing in running into the ending's red. Same stroke as the toast that
			    confirms it. A batch drops the first hue - the selection did not all come
			    from one column. */}
			<DialogContent
				className="hue-run sm:max-w-md"
				style={run(
					"closed",
					!batch && job ? STATUS_HUE[columnOf(job)] : undefined,
				)}
				initialFocus={() => area.current}
			>
				<DialogHeader>
					<DialogTitle>
						{batch ? `Reject ${count} postings` : "How did it end?"}
					</DialogTitle>
					<DialogDescription>
						{batch ? (
							<>
								The same answer is written to all {count}. Nothing ticked means
								they simply said no.
							</>
						) : (
							<>
								{job?.company ?? "This posting"} -{" "}
								{job?.title?.replace(/\s+/g, " ").trim() || "untitled"}. Nothing
								ticked means they simply said no.
							</>
						)}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-2.5">
					{OUTCOME_GROUPS.map((group) => (
						<div key={group.id}>
							<p className="legend text-muted-foreground text-legend">
								{group.label}
							</p>
							<div className="mt-1 flex flex-wrap gap-1.5">
								{OUTCOMES_BY_GROUP[group.id].map((tag) => {
									const on = held.has(tag.id);
									return (
										<button
											key={tag.id}
											type="button"
											onClick={() => toggle(tag.id)}
											aria-pressed={on}
											className={chip(on)}
										>
											{tag.label}
										</button>
									);
								})}
							</div>
						</div>
					))}
				</div>

				<div>
					<p className="legend text-muted-foreground mb-1 text-legend">
						Note (optional)
					</p>
					<Textarea
						ref={area}
						value={note}
						onChange={(e) => setNote(e.target.value)}
						// Ctrl/Cmd+Enter submits; plain Enter stays a newline.
						onKeyDown={(e) => {
							if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
								e.preventDefault();
								confirm();
							}
						}}
						rows={3}
						placeholder="What they said, who to keep in touch with, what to do differently."
						className="resize-none"
					/>
				</div>

				<DialogFooter>
					<Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button variant="destructive" size="sm" onClick={confirm}>
						{batch ? `Reject ${count}` : "Move to Rejected"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
