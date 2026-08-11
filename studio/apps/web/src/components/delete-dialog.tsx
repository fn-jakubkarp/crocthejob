import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { Job } from "@/lib/jobs";

type Props = {
	job: Job;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	/** Copies filed under this entry, which come back standalone rather than vanish. */
	copies: number;
};

/**
 * The one irreversible thing the board can do, so it asks. Offered on hand-added
 * entries only: a scraped posting deleted here is back on the next /scrape, and Skipped
 * is the column for one that was read and ruled out.
 */
export function DeleteDialog({
	job,
	open,
	onOpenChange,
	onConfirm,
	copies,
}: Props) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Delete this entry</DialogTitle>
					<DialogDescription>
						<span className="text-foreground font-medium">
							{job.company ?? "This posting"} -{" "}
							{job.title?.replace(/\s+/g, " ").trim() || "untitled"}
						</span>
						. Added by hand, so nothing brings it back: notes, dates and outcome
						go with it.
						{copies > 0 && (
							<>
								{" "}
								The {copies} {copies === 1 ? "copy" : "copies"} filed under it
								return to the board as separate postings.
							</>
						)}
					</DialogDescription>
				</DialogHeader>

				<DialogFooter>
					<Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						size="sm"
						onClick={() => {
							onConfirm();
							onOpenChange(false);
						}}
					>
						Delete
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
