import type { CSSProperties } from "react";
import { COLUMN_LABEL, type Status } from "@/lib/jobs";

/**
 * The shared vocabulary of the two reading pages, the history timeline and the stats.
 *
 * COLOUR. Eight hues, fixed in `index.css`, one meaning each. Green is the win, red is
 * an ending, the application lane walks blue to magenta as it advances, and the
 * machine's own work stays off that lane in steel and amber. Every use of colour comes
 * through `HUE`, so a stage is the same colour wherever it appears - a chip on the
 * timeline, a meter on the funnel, a bar in the histogram, the lamp in a column header,
 * the edge of the toast that says the stage just changed.
 */

export const HUE = {
	found: "var(--event-found)",
	added: "var(--event-added)",
	ranked: "var(--event-ranked)",
	applied: "var(--event-applied)",
	screening: "var(--event-screening)",
	tech: "var(--event-tech)",
	final_round: "var(--event-final-round)",
	offer: "var(--event-offer)",
	closed: "var(--event-closed)",
} as const;

export type Hue = keyof typeof HUE;

/** The board's columns in those colours. Skipped is steel: passed over, not ended. */
export const STATUS_HUE: Record<Status, Hue> = {
	new: "found",
	ranked: "ranked",
	applied: "applied",
	screening: "screening",
	tech_interview: "tech",
	final_round: "final_round",
	offer: "offer",
	rejected: "closed",
	skipped: "found",
	dismissed: "found",
	expired: "found",
};

/** Sets `--evt` for everything inside, which is what the chips and meters read. */
export const tint = (hue: Hue, extra?: CSSProperties): CSSProperties =>
	({ "--evt": HUE[hue], ...extra }) as CSSProperties;

/** One line, raised off the panel. A button when there is somewhere to go. */
export const LINE =
	"bg-card border border-border rounded-key grid w-full items-center gap-x-3 py-1.5 pr-3 pl-2 text-left";

export const LINE_HOVER =
	"transition-colors duration-150 ease-out hover:border-border-strong hover:bg-card-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal";

/**
 * The column names, cut to fit a chip. Only the technical stage needs it: "Tech
 * interview" is the one label wider than the column every chip shares, and a truncated
 * chip is a chip that has stopped being a label.
 */
export const CHIP_LABEL: Record<Status, string> = {
	...COLUMN_LABEL,
	tech_interview: "Interview",
};
