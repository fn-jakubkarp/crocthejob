import { useRef, useState } from "react";
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
	job?: Job;
	/** Rejects with the server's reason - a copy already saved, most likely. */
	onConfirm: (key: string, text: string) => Promise<void>;
};

/**
 * Pasting a JD in by hand, for a posting /scrape never kept a copy of - or never had
 * the chance to. Filed exactly where /scrape would have left it, so "Read the saved
 * copy" cannot tell the two apart afterwards.
 */
export function SavePostingDialog({
	open,
	onOpenChange,
	job,
	onConfirm,
}: Props) {
	const area = useRef<HTMLTextAreaElement>(null);
	const [text, setText] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const ready = text.trim().length > 0;

	const submit = async () => {
		if (!ready || busy || !job) return;
		setBusy(true);
		setError(null);
		try {
			await onConfirm(job.key, text.trim());
			setText("");
			onOpenChange(false);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) setText("");
				onOpenChange(next);
			}}
		>
			<DialogContent className="sm:max-w-lg" initialFocus={() => area.current}>
				<DialogHeader>
					<DialogTitle>Add the posting text</DialogTitle>
					<DialogDescription>
						{job?.company ?? "This posting"} -{" "}
						{job?.title?.replace(/\s+/g, " ").trim() || "untitled"}. Paste the
						JD; it is saved the same way /scrape would have kept it.
					</DialogDescription>
				</DialogHeader>

				<Textarea
					ref={area}
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
							e.preventDefault();
							void submit();
						}
					}}
					rows={10}
					placeholder="Paste the full job description here."
					className="resize-none"
				/>

				{error && (
					<p className="text-destructive text-meta" role="alert">
						{error}
					</p>
				)}

				<DialogFooter>
					<Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						size="sm"
						disabled={!ready || busy}
						onClick={() => void submit()}
					>
						{busy ? "Saving…" : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
