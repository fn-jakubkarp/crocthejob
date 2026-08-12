import { useCallback, useRef, useState } from "react";
import type { CommandId } from "@/lib/jobs";

/** One line of the CLI's stream-json output, narrowed to what is rendered. */
type Line = {
	type?: string;
	session_id?: string;
	is_error?: boolean;
	result?: string;
	error?: string;
	permission_denials?: { tool_name?: string }[];
	message?: {
		content?: { type?: string; text?: string; name?: string }[];
	};
};

export type RunLine = {
	id: number;
	kind: "said" | "text" | "error" | "blocked";
	text: string;
};

/**
 * What each tool is doing, in the product's own words.
 *
 * The first version of this pushed a line per tool call, so a run printed `GREP`, `GLOB`,
 * `READ` down the panel. That is a terminal's job, not an answer's: a tool call is not a
 * thing that was said, it is evidence the run is alive, and one line of that is enough.
 * Anything unmapped reads "working", which is honest and says nothing to decode.
 */
const ACTIVITY: Record<string, string> = {
	Read: "reading a file",
	Glob: "looking through the repo",
	Grep: "searching the repo",
	Write: "writing",
	Edit: "writing",
	NotebookEdit: "writing",
	Bash: "running a command",
	BashOutput: "running a command",
	WebFetch: "reading the web",
	WebSearch: "searching the web",
	Skill: "running a skill",
	Task: "working",
	TodoWrite: "planning",
};

export type Run = {
	/** The entry this run belongs to, by id. Null when nothing has been started. */
	jobId: number | null;
	/** The command it was started with, for the panel's heading. */
	command: CommandId | null;
	lines: RunLine[];
	busy: boolean;
	/** What it is doing right now, one line, overwritten. Null when nothing is. */
	activity: string | null;
	/** True once a finished run left a question hanging, so a reply can carry on. */
	open: boolean;
	start: (jobId: number, command: CommandId, stage?: string) => void;
	reply: (text: string) => void;
	stop: () => void;
	/** Drops the transcript. The artifact is the file the skill wrote, not this. */
	clear: () => void;
};

let nextLineId = 0;

/**
 * One skill run, streamed.
 *
 * MOUNTED AT THE TOP, deliberately. `/api/run` kills the child on `req.on("close")`, so
 * whatever holds the fetch holds the run's life: hang this off the job page and walking
 * back to the board mid-`/apply` kills it halfway through writing a CV.
 *
 * One at a time, matching the server's own lock. A second start while one is going gets
 * the 409 as an error line rather than silently queueing.
 */
export function useRun(onFinished: () => void): Run {
	const [jobId, setJobId] = useState<number | null>(null);
	const [command, setCommand] = useState<CommandId | null>(null);
	const [lines, setLines] = useState<RunLine[]>([]);
	const [busy, setBusy] = useState(false);
	const [activity, setActivity] = useState<string | null>(null);
	// State, not a ref: `open` is read during render, and a ref written mid-stream
	// would only appear to work because `busy` happens to re-render alongside it.
	const [session, setSession] = useState<string | undefined>(undefined);
	const sent = useRef<string | undefined>(undefined);
	const abort = useRef<AbortController | null>(null);

	const push = useCallback((kind: RunLine["kind"], text: string) => {
		setLines((prev) => [...prev, { id: nextLineId++, kind, text }]);
	}, []);

	const send = useCallback(
		async (body: Record<string, unknown>) => {
			setBusy(true);
			setActivity("thinking");
			const controller = new AbortController();
			abort.current = controller;
			// Only a run that actually started can have written anything. A 400 or the
			// 409 for a run already going is a refusal, and reloading the board on one
			// is a read of a file nothing touched.
			let ran = false;

			try {
				const res = await fetch("/api/run", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
					signal: controller.signal,
				});
				if (!res.ok || !res.body) {
					const said = await res
						.json()
						.then((b: { error?: string }) => b.error)
						.catch(() => null);
					push("error", said ?? `HTTP ${res.status}`);
					return;
				}

				ran = true;
				const reader = res.body
					.pipeThrough(new TextDecoderStream())
					.getReader();
				let buffer = "";
				for (;;) {
					const { done, value } = await reader.read();
					if (done) break;
					buffer += value;
					const chunk = buffer.split("\n");
					// The last piece may be half a line; keep it for the next read.
					buffer = chunk.pop() ?? "";
					for (const raw of chunk) {
						if (!raw.trim()) continue;
						let event: Line;
						try {
							event = JSON.parse(raw);
						} catch {
							continue;
						}
						// Every line carries it, and `--resume` can fork to a new id, so
						// take the latest rather than only the first.
						if (event.session_id && event.session_id !== sent.current) {
							sent.current = event.session_id;
							setSession(event.session_id);
						}
						if (event.type === "assistant") {
							for (const block of event.message?.content ?? []) {
								if (block.type === "text" && block.text?.trim())
									push("text", block.text);
								if (block.type === "tool_use" && block.name)
									setActivity(ACTIVITY[block.name] ?? "working");
							}
						}
						// A run that reached for a tool it does not have finishes
						// *successfully*, having worked around the gap or given up on
						// that step, and says nothing about it in its own answer. So the
						// denials are read off the result line and named. Without this a
						// `/research` that never got to fetch anything reads as a
						// research pass that found nothing.
						if (event.type === "result") {
							const blocked = [
								...new Set(
									(event.permission_denials ?? [])
										.map((denial) => denial.tool_name)
										.filter((name): name is string => Boolean(name)),
								),
							];
							if (blocked.length > 0) push("blocked", blocked.join(", "));
							if (event.is_error) push("error", event.result ?? "run failed");
						}
						if (event.type === "error" && event.error)
							push("error", event.error);
					}
				}
			} catch (err) {
				if (!controller.signal.aborted) push("error", String(err));
			} finally {
				abort.current = null;
				setBusy(false);
				setActivity(null);
				// A skill's whole job is writing to data/jobs.json, and the board is
				// holding a copy taken before it ran.
				if (ran) onFinished();
			}
		},
		[push, onFinished],
	);

	const start = useCallback(
		(id: number, name: CommandId, stage?: string) => {
			if (abort.current) return;
			sent.current = undefined;
			setSession(undefined);
			setJobId(id);
			setCommand(name);
			setLines([]);
			void send({ command: name, id, stage });
		},
		[send],
	);

	const reply = useCallback(
		(text: string) => {
			const said = text.trim();
			if (!said || abort.current || !session) return;
			push("said", said);
			void send({ reply: said, sessionId: session });
		},
		[push, send, session],
	);

	const stop = useCallback(() => {
		abort.current?.abort();
	}, []);

	const clear = useCallback(() => {
		if (abort.current) return;
		sent.current = undefined;
		setSession(undefined);
		setJobId(null);
		setCommand(null);
		setLines([]);
	}, []);

	return {
		jobId,
		command,
		lines,
		busy,
		activity,
		open: !busy && session !== undefined,
		start,
		reply,
		stop,
		clear,
	};
}
