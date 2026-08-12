import { Copy } from "lucide-react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { copyText } from "@/lib/copy";
import { DOC_COMPONENTS } from "@/lib/markdown";

/**
 * The one reading surface on the page.
 *
 * A JD is 3,000 words. Set in the page it is the page, and everything the page is for -
 * where this stands, how long it has taken, what was written - ends up below the fold of
 * a document nobody rereads. So the document opens over the page instead: the reading is
 * the interruption here, which is the one thing a modal is for.
 *
 * One surface for every document this application has: the description, the tailored
 * CV, the prep, the research. A skill's answer is not one of them - it streams in the run
 * panel, where the reply box that answers `/apply`'s question lives, and splitting a live
 * run across two surfaces would put the transcript somewhere the reply is not.
 */

/** A document to read. One shape: a skill's answer streams in the run panel, which owns
 * the reply box the run needs, so this surface is only ever a file on disk. */
export type Reading = { path: string; title: string };

export function DocModal({
	reading,
	onClose,
}: {
	reading: Reading | null;
	onClose: () => void;
}) {
	const [text, setText] = useState("");
	const [state, setState] = useState<"loading" | "ready" | "error">("loading");
	const [error, setError] = useState<string | null>(null);
	const path = reading?.path ?? null;

	useEffect(() => {
		if (!path) return;
		let live = true;
		setState("loading");
		// The last document goes with the state that described it. Held, it is what the
		// Copy button copies while the next one is still on the wire.
		setText("");
		fetch(`/api/files?path=${encodeURIComponent(path)}`)
			.then((res) => res.json())
			.then((body: { text?: string; error?: string }) => {
				if (!live) return;
				if (body.error) {
					setError(body.error);
					setState("error");
					return;
				}
				setText(body.text ?? "");
				setError(null);
				setState("ready");
			})
			.catch((err: unknown) => {
				if (!live) return;
				setError(String(err));
				setState("error");
			});
		return () => {
			live = false;
		};
	}, [path]);

	const body = text;
	// The opening heading is the document's name, and the header above already says it.
	const prose = body.replace(/^\s*#\s+.+\n+/, "");
	const loading = state === "loading";
	const ready = state === "ready";

	return (
		<Dialog
			open={reading !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			{/* Sized to the sheet's own 68-character measure rather than a step on the
			    dialog scale: at 3xl the prose sat against the left edge with a third of
			    the plate empty beside it. */}
			<DialogContent className="sm:max-w-[41rem]">
				<DialogHeader>
					<div className="flex items-start justify-between gap-4 pr-8">
						<DialogTitle className="text-module leading-tight tracking-[-0.02em] text-balance">
							{reading?.title ?? "Document"}
						</DialogTitle>
						{body && (
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Copy markdown"
								onClick={() => copyText(body, "Markdown")}
							>
								<Copy />
							</Button>
						)}
					</div>
					<DialogDescription className="font-data text-meta">
						{reading?.path}
					</DialogDescription>
				</DialogHeader>

				<div className="rule" />

				{/* Padded at the foot: without it the last line of a long document sits
				    flush in the plate's rounded corner and reads as a crop rather than an
				    end. */}
				<div className="max-h-[calc(100dvh-16rem)] min-h-24 overflow-y-auto pb-4">
					{state === "error" && (
						<p className="text-destructive rounded-key bg-[color-mix(in_oklab,var(--destructive)_10%,var(--card))] px-3 py-2.5 text-body">
							<span className="label mr-2 text-legend">Read failed</span>
							{error}
						</p>
					)}

					{loading && (
						<div aria-hidden className="animate-pulse space-y-4 py-2">
							<div className="h-3 w-full rounded-key bg-surface" />
							<div className="h-3 w-11/12 rounded-key bg-surface" />
							<div className="h-3 w-10/12 rounded-key bg-surface" />
						</div>
					)}

					{/* Only what was read: on a failed read the box above is the whole
					    answer, and prose under it would be the document before this one. */}
					{ready && (
						<div className="doc">
							<ReactMarkdown
								remarkPlugins={[remarkGfm]}
								components={DOC_COMPONENTS}
							>
								{prose}
							</ReactMarkdown>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
