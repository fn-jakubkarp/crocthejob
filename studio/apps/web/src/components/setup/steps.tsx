import { Bot, PlugZap, Upload } from "lucide-react";
import { useTheme } from "next-themes";
import { type ReactNode, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BoardView } from "@/hooks/use-board-view";
import { useSetup } from "@/hooks/use-setup";
import { COLUMNS, importJobs, type Status } from "@/lib/jobs";
import { cn } from "@/lib/utils";

/**
 * The bodies both shells render: the full-bleed intake sheet on a first run, the
 * compact dialog from the rail afterwards. Nothing in here knows which shell it is
 * inside, which is what keeps the two renditions from drifting into two different
 * settings screens. The sections they are laid out in live in `sections.ts`.
 */

const FITS = [
	{ id: "all", label: "Any" },
	{ id: "high", label: "High" },
	{ id: "medium", label: "Medium" },
	{ id: "low", label: "Low" },
];

const THEMES = [
	{ id: "system", label: "System" },
	{ id: "light", label: "Light" },
	{ id: "dark", label: "Dark" },
];

/** A pressed chip is edged in the accent. Same box either way, only the colour moves. */
export function Chip({
	on,
	onClick,
	children,
}: {
	on: boolean;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<Button
			variant="outline"
			size="xs"
			aria-pressed={on}
			className={cn(on && "border-signal text-foreground")}
			onClick={onClick}
		>
			{children}
		</Button>
	);
}

export function Field({
	legend,
	children,
}: {
	legend: string;
	children: ReactNode;
}) {
	return (
		<div>
			<p className="legend text-muted-foreground mb-1.5 text-legend">
				{legend}
			</p>
			<div className="flex flex-wrap items-center gap-1.5">{children}</div>
		</div>
	);
}

/** One of the two ways to run this repo, as a plate you press rather than a radio. */
function Choice({
	on,
	title,
	body,
	icon: Icon,
	onClick,
}: {
	on: boolean;
	title: string;
	body: string;
	icon: typeof Bot;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={onClick}
			className={cn(
				"flex flex-col gap-1.5 rounded-key border p-3 text-left transition-[background-color,border-color,color] duration-150 ease-out outline-none active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal",
				on
					? "border-signal bg-card"
					: "border-border bg-surface hover:border-border-strong hover:bg-card-hover",
			)}
		>
			<span className="flex items-center gap-2">
				<Icon
					className={cn(
						"size-4 shrink-0 transition-colors duration-150",
						on ? "text-signal-ink" : "text-muted-foreground",
					)}
				/>
				<span className="label text-meta">{title}</span>
			</span>
			<span className="text-muted-foreground text-meta leading-[1.5]">
				{body}
			</span>
		</button>
	);
}

export function ModeStep({ view }: { view: BoardView }) {
	const { setup, save } = useSetup();
	return (
		<div className="grid gap-2 sm:grid-cols-2">
			<Choice
				on={setup.ai}
				icon={Bot}
				title="With Claude Code"
				body="Chat runs your local claude in the repo. /scrape, /rank and /apply write the board, and the cards carry the score."
				onClick={() => save({ ai: true })}
			/>
			<Choice
				on={!setup.ai}
				icon={PlugZap}
				title="Offline, no AI"
				body="You keep postings and stages by hand. No score, no rank breakdown, no chat page."
				// The fit key goes with the readings, so a filter left on high would
				// hide the board with nothing on screen to clear it.
				onClick={() => {
					save({ ai: false });
					view.setFit("all");
				}}
			/>
		</div>
	);
}

/**
 * The theme, the columns and the filter the board opens on. Given `counts`, the
 * columns field carries the board's own heads under it, so pressing a chip is
 * watched rather than read about.
 */
export function BoardStep({
	view,
	counts,
}: {
	view: BoardView;
	counts?: Map<Status, number>;
}) {
	const { setup } = useSetup();
	const { theme, setTheme } = useTheme();

	return (
		<div className="space-y-3.5">
			{/* "Theme", not the build's own word for it: `plate` names the ground in
			    the stylesheet, a floating panel in the dock and a 16px type step, and a
			    legend has one line to say which. */}
			<Field legend="Theme">
				{THEMES.map((entry) => (
					<Chip
						key={entry.id}
						on={theme === entry.id}
						onClick={() => setTheme(entry.id)}
					>
						{entry.label}
					</Chip>
				))}
			</Field>

			<Field legend="Columns on the board">
				{COLUMNS.map((col) => (
					<Chip
						key={col.status}
						on={view.visible.includes(col.status)}
						onClick={() => view.toggleColumn(col.status)}
					>
						{col.label}
					</Chip>
				))}
				<Button
					variant="ghost"
					size="xs"
					className="text-muted-foreground"
					onClick={view.resetColumns}
				>
					Reset
				</Button>
			</Field>

			{counts && <ColumnStrip view={view} counts={counts} />}

			<Field legend="The filter it opens on">
				{setup.ai &&
					FITS.map((entry) => (
						<Chip
							key={entry.id}
							on={view.fit === entry.id}
							onClick={() => view.setFit(entry.id)}
						>
							{entry.label} fit
						</Chip>
					))}
				<Chip on={view.showDupes} onClick={view.toggleDupes}>
					Show duplicates
				</Chip>
			</Field>
		</div>
	);
}

/**
 * The board's own column heads, in pipeline order, over the real counts in the file.
 * A head arrives and leaves with its chip, so the columns field answers itself.
 */
function ColumnStrip({
	view,
	counts,
}: {
	view: BoardView;
	counts: Map<Status, number>;
}) {
	// A board with nothing in it yet is the ordinary first run, and a row of heads over
	// seven zeroes reads as a broken instrument rather than an empty one - and says
	// nothing the chips above it did not already say. It comes back with the postings.
	let held = 0;
	for (const n of counts.values()) held += n;
	if (held === 0) return null;

	return (
		<div
			aria-hidden
			className="flex gap-1 overflow-x-auto rounded-key bg-track p-1"
		>
			{view.shown.length === 0 ? (
				<p className="text-muted-foreground px-1.5 py-1 text-meta">
					No columns. The board would open empty.
				</p>
			) : (
				view.shown.map((col) => (
					<div
						key={col.status}
						className="bg-card flex min-w-[4.5rem] flex-1 flex-col gap-1 rounded-tile border border-border px-1.5 py-1 duration-200 ease-out animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none"
					>
						<span className="label text-muted-foreground block truncate text-legend">
							{col.label}
						</span>
						<span className="font-data text-title tabular-nums">
							{counts.get(col.status) ?? 0}
						</span>
					</div>
				))
			)}
		</div>
	);
}

/** The jobs file step: a file off disk, folded into the board's own. */
export function ImportStep({
	onImported,
	onNote,
}: {
	onImported: () => void;
	/** The spine prints the same sentence the step does. */
	onNote?: (note: string) => void;
}) {
	const [note, setNote] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [over, setOver] = useState(false);
	// The picker is opened by the key beside it, so the input itself is display:none
	// rather than sr-only: hidden, unfocusable, and still clickable in code.
	const picker = useRef<HTMLInputElement>(null);

	const take = async (file: File | undefined) => {
		if (!file) return;
		setBusy(true);
		setNote(null);
		try {
			const counts = await importJobs(JSON.parse(await file.text()));
			const line =
				`${counts.added} added, ${counts.skipped} already on the board` +
				(counts.dropped > 0 ? `, ${counts.dropped} unreadable` : "");
			setNote(line);
			onNote?.(line);
			if (counts.added > 0) onImported();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			setNote(null);
			toast.error("That file did not import", { description: message });
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="space-y-2">
			{/* A drop target rather than a button with a paragraph beside it: the board
			    is dragged for a living, and the accent rim it lights is the same one a
			    receptive column shows. */}
			<div
				onDragOver={(e) => {
					e.preventDefault();
					setOver(true);
				}}
				onDragLeave={() => setOver(false)}
				onDrop={(e) => {
					e.preventDefault();
					setOver(false);
					void take(e.dataTransfer.files[0]);
				}}
				className={cn(
					"flex flex-wrap items-center gap-2.5 rounded-key border border-dashed p-3 transition-[background-color,border-color] duration-150 ease-out",
					over
						? "border-signal bg-[color-mix(in_oklab,var(--signal)_10%,var(--card))]"
						: "border-border bg-surface",
				)}
			>
				<Button
					variant="outline"
					size="sm"
					disabled={busy}
					onClick={() => picker.current?.click()}
				>
					<Upload />
					{busy ? "Reading…" : "Choose a file"}
				</Button>
				<input
					ref={picker}
					type="file"
					accept=".json,application/json"
					className="hidden"
					onChange={(e) => {
						void take(e.target.files?.[0]);
						// Cleared, so picking the same file again still fires a change.
						e.target.value = "";
					}}
				/>
				<span className="text-muted-foreground text-meta">
					{note ?? "…or drop a jobs.json here"}
				</span>
			</div>

			<p className="text-muted-foreground text-meta">
				Nothing already on the board is touched, so importing twice adds nothing
				the second time.
			</p>
		</div>
	);
}
