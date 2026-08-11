import type { Lane } from "@/lib/jobs";
import { cn } from "@/lib/utils";

const LAMP: Record<string, string> = {
	high: "[--lamp:var(--lamp-high)]",
	medium: "[--lamp:var(--lamp-mid)]",
	low: "[--lamp:var(--lamp-low)]",
};

export /**
 * The tile itself: one plane above the track it sits in, edged with a hairline and
 * casting nothing. Lift while grabbed and the selection rim live in index.css.
 */
function tileClass(
	lane: Lane,
	lamp: string,
	open: boolean,
	isCopy: boolean,
): string {
	return cn(
		// No `active:scale-*`: :active is already true when Chromium rasterises
		// the ghost, so the scale bakes in. Lift lives in drag-state.ts.
		"group relative flex w-full cursor-grab flex-col rounded-tile border border-border bg-card text-left transition-[background-color,border-color,box-shadow,opacity] duration-150 ease-out hover:border-border-strong hover:bg-card-hover active:cursor-grabbing",
		"focus-visible:outline-signal focus-visible:outline-2 focus-visible:outline-offset-1",
		// Grabbed state, the [data-selected] rim, and holding this lift under the
		// pointer all live in index.css: each has to outrank the hover plane above,
		// which Tailwind emits after anything declared here.
		open && "elev-drag",
		lane === "live" && "gap-1 px-2.5 py-2.5",
		lane === "intake" && "gap-0.5 px-2.5 py-2",
		// The archive runs to the hundreds, so its rows sit one plane lower and read
		// as a list rather than as a stack of cards.
		lane === "archive" && "gap-0.5 bg-surface px-2.5 py-1.5",
		// A copy reads as subordinate to the card it is filed under.
		isCopy && "opacity-70",
		LAMP[lamp] ?? LAMP.low,
	);
}
