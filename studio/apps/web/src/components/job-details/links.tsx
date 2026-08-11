import {
	CopyMinus,
	ExternalLink,
	FilePlus,
	FileText,
	Link,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { COLUMN_LABEL, columnOf, type DupCopy, type Job } from "@/lib/jobs";

/**
 * What the board hides behind this card. A copy from another portal is often the one
 * with the salary.
 */
function Copies({
	copies,
	onUnlinkDuplicate,
}: {
	copies?: DupCopy[];
	onUnlinkDuplicate: (key: string) => void;
}) {
	if (!copies || copies.length === 0) return null;
	return (
		<div>
			<p className="label text-muted-foreground mb-2 text-data">
				{copies.length} duplicate{copies.length === 1 ? "" : "s"} hidden
			</p>
			<ul className="space-y-1.5">
				{copies.map(({ job: other, label }) => (
					<li
						key={other.key}
						className="bg-surface border border-border rounded-key flex items-center gap-2 px-2.5 py-1.5"
					>
						<span className="text-muted-foreground shrink-0 font-data text-data tabular-nums">
							{label}
						</span>
						<span className="min-w-0 flex-1 truncate text-meta">
							{other.portal?.replace(/-search/g, "") ?? "?"}
							{" · "}
							<span className="text-muted-foreground">
								{COLUMN_LABEL[columnOf(other)]}
							</span>
						</span>
						{other.url && (
							<a
								href={other.url}
								target="_blank"
								rel="noreferrer noopener"
								className="text-muted-foreground hover:text-signal-ink relative shrink-0 transition-colors after:absolute after:-inset-2.5 after:content-['']"
								aria-label={`Open ${label} in a new tab`}
							>
								<ExternalLink className="size-3.5" />
							</a>
						)}
						<button
							type="button"
							onClick={() => onUnlinkDuplicate(other.key)}
							className="text-muted-foreground hover:text-foreground relative shrink-0 text-meta font-medium transition-colors after:absolute after:-inset-2 after:content-['']"
						>
							unhide
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}

export /** The copies behind this card, and the two ways to read it. */
function Links({
	job,
	copy,
	copies,
	onUnlinkDuplicate,
	onReadPosting,
	onAddPosting,
	onEditUrl,
}: {
	job: Job;
	copy?: DupCopy;
	copies?: DupCopy[];
	onUnlinkDuplicate: (key: string) => void;
	onReadPosting: () => void;
	/** Opens the dialog that saves a hand-typed JD for an entry with none. */
	onAddPosting: () => void;
	/** Opens the edit dialog with the cursor already in the URL field. */
	onEditUrl: () => void;
}) {
	return (
		<>
			<Copies copies={copies} onUnlinkDuplicate={onUnlinkDuplicate} />

			{copy && (
				<Button
					variant="outline"
					size="sm"
					className="w-full"
					onClick={() => onUnlinkDuplicate(job.key)}
				>
					<CopyMinus className="size-3.5" />
					Not a duplicate - put it back
				</Button>
			)}

			<div className="flex gap-2">
				{/* Both buttons on every entry, same controls in the same places whatever
				    the entry has. Missing either, the button becomes the way to add it. */}
				{job.url ? (
					<Button
						variant="outline"
						size="sm"
						className="flex-1"
						// Renders an <a>, so base-ui must not expect a native <button> - it warns
						// on every open otherwise.
						nativeButton={false}
						render={
							<a href={job.url} target="_blank" rel="noreferrer noopener" />
						}
					>
						<ExternalLink className="size-3.5" />
						Open the posting
					</Button>
				) : (
					<Button
						variant="outline"
						size="sm"
						className="flex-1"
						onClick={onEditUrl}
					>
						<Link className="size-3.5" />
						No link recorded
					</Button>
				)}
				{/* The live listing on the left, the copy /scrape kept on the right. The
				    saved text outlives the listing, which is the point of keeping it. */}
				{job.posting_file ? (
					<Button
						variant="outline"
						size="sm"
						className="flex-1"
						onClick={onReadPosting}
					>
						<FileText className="size-3.5" />
						Read the saved copy
					</Button>
				) : (
					<Button
						variant="outline"
						size="sm"
						className="flex-1"
						onClick={onAddPosting}
					>
						<FilePlus className="size-3.5" />
						Nothing saved
					</Button>
				)}
			</div>
		</>
	);
}
