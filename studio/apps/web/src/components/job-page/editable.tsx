import { format, parseISO } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { isoDate, shortDate } from "@/lib/jobs";
import { cn } from "@/lib/utils";

/**
 * A value that is also where it gets corrected.
 *
 * The details popover reads and the dialog writes, because a panel where every value
 * is a control has no resting state. A page is not a panel: you are here because this
 * one application is the thing you are working on, and being sent to a dialog to fix a
 * salary you are looking at is the cost that principle was never meant to buy.
 *
 * What keeps the resting state is that the affordance is the *track's*, not the
 * field's. Nothing is outlined until the pointer is in the block, and then every
 * editable value picks up the same dashed rule at once - the same move the section
 * rail makes with its labels. At rest it reads as text, which is what it is.
 *
 * Every write goes through the caller's own save, which is the dialog's path too, so
 * an entry re-keyed by a corrected URL is followed rather than lost.
 */

/** Where it sits: a labelled field in a block, or a value on one line of a list. */
type Look = "field" | "line";

const REST =
	"rounded-[3px] text-left transition-[background-color,border-color] duration-150 ease-out border-b border-dashed border-transparent outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

/**
 * Revealed together, on the block's own hover group - and standing where there is no
 * hover to reveal it. On a touch screen the reveal never happens, so the rule is
 * permanently there at the quieter weight; a pointer gets the resting state the reveal
 * was for.
 */
const HINT =
	"border-border/60 [@media(hover:hover)]:border-transparent group-hover/edits:border-border-strong hover:!border-signal hover:text-foreground";

function Nothing() {
	return (
		<>
			<span aria-hidden="true">-</span>
			<span className="sr-only">not recorded</span>
		</>
	);
}

export function EditableText({
	label,
	value,
	placeholder,
	onSave,
	look = "field",
	numeric,
	wide,
	multiline,
	className,
	textClassName,
}: {
	label: string;
	value?: string;
	placeholder?: string;
	/** Trimmed. An empty string is how a field is cleared. */
	onSave: (value: string) => void;
	look?: Look;
	numeric?: boolean;
	wide?: boolean;
	/** For text that runs past a line - a log entry, a scraper's sentence. */
	multiline?: boolean;
	className?: string;
	/** On the value itself, read and editing alike, so a heading stays a heading. */
	textClassName?: string;
}) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(value ?? "");

	// The stored value wins whenever editing is not open, so a write landing from
	// somewhere else is not held off by a stale draft.
	useEffect(() => {
		if (!editing) setDraft(value ?? "");
	}, [value, editing]);

	const commit = () => {
		setEditing(false);
		const next = draft.trim();
		if (next !== (value ?? "").trim()) onSave(next);
	};

	const keys = (e: React.KeyboardEvent) => {
		if (e.key === "Escape") {
			// Stopped, not just prevented: React flushes this state change synchronously,
			// the field unmounts, focus falls back to the body, and the app's one key
			// listener then reads Escape as "nothing was open" and leaves the page.
			e.preventDefault();
			e.stopPropagation();
			setDraft(value ?? "");
			setEditing(false);
		}
		// Enter commits even in the textarea: a log line is one line, and the newline
		// it would insert is what splits it into two entries.
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			commit();
		}
	};

	const field = look === "field";

	if (editing) {
		const shared = {
			value: draft,
			autoFocus: true,
			placeholder,
			"aria-label": label,
			onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
			onKeyDown: keys,
			onBlur: commit,
		};
		return (
			<div className={cn(field && "min-w-0", wide && "col-span-2", className)}>
				{field && <p className="legend text-signal-ink text-legend">{label}</p>}
				{multiline ? (
					<Textarea
						{...shared}
						rows={2}
						className={cn(
							"resize-none text-body leading-[1.5]",
							field && "mt-0.5",
							textClassName,
						)}
					/>
				) : (
					<Input
						{...shared}
						className={cn("h-7 text-body", field && "mt-0.5", textClassName)}
					/>
				)}
			</div>
		);
	}

	const missing = !value;
	const prompt = missing && !field && !!placeholder;

	return (
		<div className={cn(field && "min-w-0", wide && "col-span-2", className)}>
			{field && (
				<p className="legend text-muted-foreground text-legend">{label}</p>
			)}
			<button
				type="button"
				onClick={() => setEditing(true)}
				// The field, its value, then the action. `Edit salary` alone replaced the
				// button's own content, so the one thing a reader is here for - what the
				// salary actually says - was never announced.
				aria-label={`${label}: ${value ?? "not recorded"}. Edit`}
				className={cn(
					REST,
					HINT,
					"block max-w-full text-body",
					field && "mt-0.5",
					multiline ? "text-pretty" : "truncate",
					numeric && !missing && "font-data text-meta tabular-nums",
					missing ? "text-muted-foreground/70" : "text-foreground",
					prompt && "italic",
					textClassName,
				)}
			>
				{/* A dash says nobody recorded this. On a labelled fact that is the whole
				    answer, and a prompt in its place ("City, hybrid 2 days/week") reads as
				    the recorded location. Only the prose a line-look holds - the standing
				    note nobody has written yet - is invited rather than dashed. */}
				{missing ? prompt ? placeholder : <Nothing /> : value}
			</button>
		</div>
	);
}

/**
 * A date, corrected where it is read. `shortDate` on a line and the full ISO in a
 * field, because the field has the width and a log row does not.
 */
export function EditableDate({
	label,
	value,
	onSave,
	look = "field",
	wide,
	hue,
}: {
	label: string;
	value?: string;
	onSave: (iso: string) => void;
	look?: Look;
	wide?: boolean;
	/** A line-look date takes the row's own colour, like everything else on it. */
	hue?: boolean;
}) {
	const [open, setOpen] = useState(false);
	// Checked before it is parsed: a stray string in the file otherwise reaches the
	// calendar as an Invalid Date, which is a blank month with no way back.
	const stored = isoDate(value);
	const selected = stored ? parseISO(stored) : undefined;
	const field = look === "field";

	return (
		<div className={cn(field && "min-w-0", wide && "col-span-2")}>
			{field && (
				<p className="legend text-muted-foreground text-legend">{label}</p>
			)}
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger
					render={
						<button
							type="button"
							aria-label={`${label}: ${value ?? "not recorded"}. Edit`}
							className={cn(
								REST,
								HINT,
								"block font-data tabular-nums",
								field ? "mt-0.5 text-meta" : "text-data",
								value
									? hue
										? "text-[var(--evt)]"
										: "text-foreground"
									: "text-muted-foreground/70",
							)}
						/>
					}
				>
					{value ? field ? value : shortDate(value) : <Nothing />}
				</PopoverTrigger>
				<PopoverContent className="w-auto p-0" align="start">
					<Calendar
						mode="single"
						selected={selected}
						onSelect={(date) => {
							setOpen(false);
							onSave(date ? format(date, "yyyy-MM-dd") : "");
						}}
						autoFocus
					/>
				</PopoverContent>
			</Popover>
		</div>
	);
}

/**
 * One line typed in and committed, then gone - the log's own composer. Held open
 * rather than toggled shut on save: a run of entries is typed one after another.
 */
export function AddLine({
	placeholder,
	onAdd,
}: {
	placeholder: string;
	onAdd: (text: string) => void;
}) {
	const [text, setText] = useState("");
	const input = useRef<HTMLInputElement>(null);

	const submit = () => {
		const next = text.trim();
		if (!next) return;
		setText("");
		onAdd(next);
		input.current?.focus();
	};

	return (
		<Input
			ref={input}
			value={text}
			placeholder={placeholder}
			aria-label="Add a log entry"
			onChange={(e) => setText(e.target.value)}
			onKeyDown={(e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					submit();
				}
				// Same reason as the field above: clearing the box is the answer to Escape
				// here, so the page must not also take it as one.
				if (e.key === "Escape") {
					e.stopPropagation();
					setText("");
				}
			}}
			className="h-8 text-body"
		/>
	);
}
