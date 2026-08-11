import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/* The `--text-*` rungs from index.css. tailwind-merge reads an unknown `text-<x>` as a
   colour, so without this `cn("text-data", "text-ink-2")` silently drops the size. */
const TEXT_RUNGS = [
	"headline",
	"readout",
	"module",
	"plate",
	"title",
	"body",
	"meta",
	"data",
	"legend",
];

const twMerge = extendTailwindMerge({
	extend: { classGroups: { "font-size": [{ text: TEXT_RUNGS }] } },
});

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
