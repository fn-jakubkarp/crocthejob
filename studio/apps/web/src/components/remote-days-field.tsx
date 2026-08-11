import { useCallback, useRef } from "react";
import { modeRemoteDays, REMOTE_DAYS, remoteDaysMode } from "@/lib/jobs";
import { cn } from "@/lib/utils";

const LAST = REMOTE_DAYS.length - 1;

type Props = {
	/** The stored `work_mode` string, or "" for not set. */
	value: string;
	onChange: (value: string) => void;
	id?: string;
};

/**
 * Six buttons, 0 to 5 - typing "100% remote" was the slowest part of adding a posting
 * by hand, and the answer is a day count every time.
 *
 * Unset is distinct from 0: a posting whose mode you do not know must not claim one.
 * The server drops `work_mode` when it arrives empty.
 */
export function RemoteDaysField({ value, onChange, id }: Props) {
	const group = useRef<HTMLDivElement>(null);
	const set = modeRemoteDays(value);
	const labelId = `${id ?? "remote-days"}-label`;

	// Roving tabindex: one tab stop, arrows move inside. Six buttons would cost six tabs.
	const move = useCallback(
		(to: number) => {
			const next = Math.min(LAST, Math.max(0, to));
			onChange(remoteDaysMode(REMOTE_DAYS[next]));
			group.current?.querySelectorAll("button")[next]?.focus();
		},
		[onChange],
	);

	const onKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			switch (e.key) {
				case "ArrowRight":
				case "ArrowDown":
					e.preventDefault();
					// From unset, enter at the near end rather than jumping.
					return move(set === null ? 0 : set + 1);
				case "ArrowLeft":
				case "ArrowUp":
					e.preventDefault();
					return move(set === null ? LAST : set - 1);
				case "Home":
					e.preventDefault();
					return move(0);
				case "End":
					e.preventDefault();
					return move(LAST);
				case "Backspace":
				case "Delete":
					e.preventDefault();
					return onChange("");
				default:
			}
		},
		[move, onChange, set],
	);

	return (
		<div className="grid gap-1.5">
			<div className="flex items-baseline justify-between gap-2">
				{/* Not a `<label>`: `role="radiogroup"` is not labelable, so the group
				    associates via `aria-labelledby`. */}
				<span id={labelId} className="legend text-muted-foreground text-data">
					How many days are remote
				</span>
				{set !== null && (
					<button
						type="button"
						onClick={() => onChange("")}
						className="legend text-muted-foreground hover:text-foreground relative text-legend transition-colors after:absolute after:-inset-2 after:content-['']"
					>
						clear
					</button>
				)}
			</div>

			<div
				ref={group}
				id={id}
				role="radiogroup"
				aria-labelledby={labelId}
				onKeyDown={onKeyDown}
				className="flex gap-1.5"
			>
				{REMOTE_DAYS.map((days, i) => {
					const on = set === days;
					return (
						// ARIA radiogroup on purpose: the group owns roving tabindex and arrow
						// keys, and these keep styling a native radio would not.
						// biome-ignore lint/a11y/useSemanticElements: see above
						<button
							key={days}
							type="button"
							role="radio"
							aria-checked={on}
							// The one stop: the pressed button, or the first if none is.
							tabIndex={on || (set === null && i === 0) ? 0 : -1}
							onClick={() => onChange(on ? "" : remoteDaysMode(days))}
							className={cn(
								"h-7 flex-1 rounded-key border text-body font-medium tabular-nums transition-[color,background-color,border-color] duration-150 ease-out outline-none active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal",
								on
									? "border-signal bg-signal text-signal-foreground"
									: "border-border bg-card text-muted-foreground hover:border-border-strong hover:bg-card-hover hover:text-foreground",
							)}
						>
							{days}
						</button>
					);
				})}
			</div>
		</div>
	);
}
