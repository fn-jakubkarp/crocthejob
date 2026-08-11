import { CornerDownLeft, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Turn = {
	id: number;
	role: "user" | "assistant" | "tool" | "error";
	text: string;
};

let nextId = 0;

/** One line of the CLI's stream-json output, narrowed to what is rendered. */
type Line = {
	type?: string;
	subtype?: string;
	session_id?: string;
	is_error?: boolean;
	result?: string;
	error?: string;
	message?: {
		content?: { type?: string; text?: string; name?: string }[];
	};
};

/**
 * Claude, in the app. The prompt goes to `/api/chat`, which runs the local `claude` CLI
 * in the repo root - so the same subscription, the same skills and the same files as the
 * terminal. Paste a job description here and the job-application skills fire the way
 * they do in a shell.
 *
 * Deliberately plain: a transcript, a box, a send key. Tool calls show as one grey line
 * each, enough to see the assistant working without turning this into a second terminal.
 */
export function ChatPage() {
	const [turns, setTurns] = useState<Turn[]>([]);
	const [draft, setDraft] = useState("");
	const [busy, setBusy] = useState(false);
	const session = useRef<string | undefined>(undefined);
	const abort = useRef<AbortController | null>(null);
	const tail = useRef<HTMLDivElement>(null);

	useEffect(() => {
		tail.current?.scrollIntoView({ block: "end" });
	}, []);

	const push = (turn: Omit<Turn, "id">) => {
		setTurns((prev) => [...prev, { ...turn, id: nextId++ }]);
		queueMicrotask(() => tail.current?.scrollIntoView({ block: "end" }));
	};

	const send = async () => {
		const prompt = draft.trim();
		if (!prompt || busy) return;
		setDraft("");
		push({ role: "user", text: prompt });
		setBusy(true);

		const controller = new AbortController();
		abort.current = controller;

		try {
			const res = await fetch("/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt, sessionId: session.current }),
				signal: controller.signal,
			});
			if (!res.ok || !res.body) {
				push({ role: "error", text: `HTTP ${res.status}` });
				return;
			}

			const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
			let buffer = "";
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += value;
				const lines = buffer.split("\n");
				// The last piece may be half a line; keep it for the next chunk.
				buffer = lines.pop() ?? "";
				for (const line of lines) {
					if (!line.trim()) continue;
					let event: Line;
					try {
						event = JSON.parse(line);
					} catch {
						continue;
					}
					// Every line carries it, and `--resume` can fork to a new id, so take
					// the latest rather than only the first.
					if (event.session_id) session.current = event.session_id;
					if (event.type === "assistant") {
						for (const block of event.message?.content ?? []) {
							if (block.type === "text" && block.text?.trim()) {
								push({ role: "assistant", text: block.text });
							}
							if (block.type === "tool_use" && block.name) {
								push({ role: "tool", text: block.name });
							}
						}
					}
					if (event.type === "result" && event.is_error) {
						push({ role: "error", text: event.result ?? "run failed" });
					}
					if (event.type === "error" && event.error) {
						push({ role: "error", text: event.error });
					}
				}
			}
		} catch (err) {
			if (!controller.signal.aborted) {
				push({ role: "error", text: String(err) });
			}
		} finally {
			abort.current = null;
			setBusy(false);
		}
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col pl-[4.5rem]">
			<h1 className="sr-only">Chat</h1>

			<div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 overflow-y-auto px-4 py-6">
				{turns.length === 0 && (
					<p className="text-muted-foreground m-auto max-w-md text-center text-body">
						Runs the local Claude Code in the repo root. Paste a job posting, or
						ask for a tailored CV.
					</p>
				)}

				{turns.map((turn) => (
					<div
						key={turn.id}
						className={cn(
							"rounded-key px-3 py-2.5 text-body whitespace-pre-wrap",
							turn.role === "user" && "bg-surface border border-border ml-12",
							turn.role === "assistant" && "bg-card border border-border mr-12",
							turn.role === "tool" &&
								"text-muted-foreground py-1 text-legend uppercase",
							turn.role === "error" &&
								"text-destructive bg-[color-mix(in_oklab,var(--destructive)_10%,var(--card))]",
						)}
					>
						{turn.text}
					</div>
				))}

				<div ref={tail} />
			</div>

			<div className="mx-auto flex w-full max-w-3xl items-end gap-2 px-4 pb-6">
				<Textarea
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={(e) => {
						// Enter sends, Shift+Enter is a newline - a pasted posting needs both.
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							void send();
						}
					}}
					placeholder="Message Claude"
					className="max-h-64"
					aria-label="Message"
				/>
				{busy ? (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => abort.current?.abort()}
						aria-label="Stop"
					>
						<Square />
					</Button>
				) : (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => void send()}
						disabled={!draft.trim()}
						aria-label="Send"
					>
						<CornerDownLeft />
					</Button>
				)}
			</div>
		</div>
	);
}
