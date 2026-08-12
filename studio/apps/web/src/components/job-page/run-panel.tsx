import { CornerDownLeft, Loader2, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Run } from "@/hooks/use-run";
import { COMMANDS } from "@/lib/jobs";
import { cn } from "@/lib/utils";

/**
 * A skill running against this entry, live.
 *
 * NOT A CHAT. The transcript is the working, and it is thrown away when the panel is
 * shut: what a run leaves behind is the file it wrote, which shows up under Documents
 * beside it. Keeping the conversation would put a second, unversioned record of an
 * application next to the one in `documents/`, and the two would disagree within a week.
 *
 * The reply box is here for one reason: `/apply` stops before it drafts and asks whether
 * to go ahead, and a run in `-p` mode has nobody to answer it. It appears only once a run
 * has ended with the session still resumable.
 */
export function RunPanel({ run }: { run: Run }) {
	const [draft, setDraft] = useState("");
	const tail = useRef<HTMLDivElement>(null);
	const label = run.command ? COMMANDS[run.command].label : null;

	useEffect(() => {
		tail.current?.scrollIntoView({ block: "end" });
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: the length is the signal
	useEffect(() => {
		tail.current?.scrollIntoView({ block: "end", behavior: "smooth" });
	}, [run.lines.length]);

	const send = () => {
		run.reply(draft);
		setDraft("");
	};

	return (
		<section className="bg-surface border border-border rounded-well p-4">
			<div className="mb-3 flex items-center gap-2">
				<p className="label text-muted-foreground text-data">
					{label ?? "Run"}
				</p>
				{run.busy && (
					<>
						<Loader2 className="text-muted-foreground size-3 animate-spin" />
						{/* One line, overwritten. What it is doing is worth a sign of life;
						    which tool it reached for is not something to read. */}
						<span className="text-muted-foreground truncate text-meta">
							{run.activity ?? "working"}
						</span>
					</>
				)}
				<div className="ml-auto flex items-center gap-1">
					{run.busy ? (
						<Button
							variant="ghost"
							size="sm"
							onClick={run.stop}
							className="text-muted-foreground hover:text-foreground"
						>
							<Square className="size-3" />
							Stop
						</Button>
					) : (
						<Button
							variant="ghost"
							size="icon-sm"
							onClick={run.clear}
							aria-label="Close the run"
							className="text-muted-foreground hover:text-foreground"
						>
							<X className="size-3.5" />
						</Button>
					)}
				</div>
			</div>

			<div className="max-h-[26rem] space-y-2 overflow-y-auto">
				{run.lines.length === 0 && (
					<p className="text-muted-foreground text-meta">Starting.</p>
				)}
				{run.lines.map((line) =>
					line.kind === "blocked" ? (
						// Not an error: the run finished. But it worked without a tool it
						// reached for, and the answer above will not say so. Which tool,
						// and where the answer lives - which is a settings file on this
						// machine, never a button here. See the note in `run-api.ts`.
						<div
							key={line.id}
							className="text-ink-2 rounded-key border border-border bg-background px-3 py-2.5 text-meta leading-[1.5]"
						>
							<span className="label text-muted-foreground mr-2 text-legend">
								Tool blocked
							</span>
							<span className="font-data text-data">{line.text}</span>
							<p className="text-muted-foreground mt-1.5 text-data leading-[1.45]">
								Your Claude Code settings deny this tool, so the run worked
								around it. Allow it in{" "}
								<span className="font-data">.claude/settings.json</span> if the
								result looks thin.
							</p>
						</div>
					) : (
						<p
							key={line.id}
							className={cn(
								"text-body leading-[1.5] whitespace-pre-wrap",
								line.kind === "said" &&
									"text-ink-2 border-l-2 border-border pl-2",
								line.kind === "text" && "text-foreground",
								line.kind === "error" &&
									"text-destructive rounded-key bg-[color-mix(in_oklab,var(--destructive)_10%,var(--card))] px-3 py-2.5",
							)}
						>
							{line.kind === "error" && (
								<span className="label mr-2 text-legend">Run failed</span>
							)}
							{line.text}
						</p>
					),
				)}
				<div ref={tail} />
			</div>

			{run.open && (
				<div className="mt-3 flex items-end gap-2">
					<Textarea
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								send();
							}
						}}
						rows={2}
						placeholder="Answer it, and the run carries on where it stopped."
						className="min-h-0 flex-1 resize-none text-body"
					/>
					<Button size="sm" onClick={send} disabled={!draft.trim()}>
						<CornerDownLeft className="size-3.5" />
						Send
					</Button>
				</div>
			)}
		</section>
	);
}
