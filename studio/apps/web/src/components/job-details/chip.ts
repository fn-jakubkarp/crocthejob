import { cn } from "@/lib/utils";

/**
 * The pressable chip the stage row and the outcome row are both made of. Held
 * reads as a tint of the accent behind accent ink and an accent rim; unheld is an
 * ordinary tile. No depth in either state - the colour is the whole answer.
 */
export const chip = (on: boolean) =>
	cn(
		"rounded-key border px-2 py-1 text-meta font-medium transition-[border-color,background-color,color,translate] duration-150 ease-out",
		"focus-visible:outline-signal focus-visible:outline-2 focus-visible:outline-offset-1",
		on
			? "border-signal bg-[color-mix(in_oklab,var(--signal)_15%,transparent)] text-signal-ink font-semibold"
			: "border-border bg-card text-ink-2 hover:border-border-strong hover:bg-card-hover hover:text-foreground active:translate-y-px",
	);
