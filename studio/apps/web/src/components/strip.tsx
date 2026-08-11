import type { CSSProperties, ReactNode } from "react";
import { HUE, type Hue } from "@/lib/strip";
import { cn } from "@/lib/utils";

/**
 * The pieces the reading pages are built from: the history timeline and the stats.
 *
 * Both are the same object at different scales - a strip of lines under a heading,
 * each line opening with a filled chip in the colour of what it is. The board is
 * recessed wells holding raised cards and the chip is the one thing on either page
 * that is neither: a flat anodized tag, so it reads as a label rather than as another
 * control.
 *
 * The colours and the class strings they share live in `@/lib/strip`; this file is
 * only what draws them.
 */

/**
 * The colour and the word at once. Fixed width wherever a column of them appears, so
 * the kinds stack into one readable stripe and whatever follows lines up under itself.
 */
export function Chip({
	children,
	className,
	style,
}: {
	children: ReactNode;
	className?: string;
	/** Where `--evt` is set, when no ancestor has already tinted the row. */
	style?: CSSProperties;
}) {
	return (
		<span
			style={style}
			className={cn(
				"legend hue-chip truncate rounded-chip px-1.5 py-[3px] text-center text-legend",
				className,
			)}
		>
			{children}
		</span>
	);
}

/**
 * What sits over a strip of lines: what this is, a note about it, the colours in it,
 * and its total. The rule between them does the separating, so no section needs a box
 * around it.
 */
export function StripHead({
	label,
	note,
	hues,
	reading,
}: {
	label: string;
	/** A word about the strip - an age, a qualifier. */
	note?: string;
	/** The colours present below, read before a word of the strip is. */
	hues?: Hue[];
	reading?: ReactNode;
}) {
	return (
		<div className="mb-2 flex items-center gap-2.5">
			<h2 className="legend text-ink-2 shrink-0 text-body">{label}</h2>
			{note && (
				<span className="text-muted-foreground shrink-0 font-data text-meta tabular-nums">
					{note}
				</span>
			)}
			<span aria-hidden className="rule min-w-0 flex-1" />
			{hues && hues.length > 0 && (
				<span aria-hidden className="flex shrink-0 items-center gap-1">
					{hues.map((hue) => (
						<span
							key={hue}
							className="size-2 rounded-full"
							style={{ background: HUE[hue] }}
						/>
					))}
				</span>
			)}
			{reading != null && (
				<span className="text-muted-foreground shrink-0 font-data text-meta tabular-nums">
					{reading}
				</span>
			)}
		</div>
	);
}

/**
 * A nonzero value never renders as nothing: below a sliver the groove would read as
 * empty, which is a different claim from "one out of 347". The exact figure is always
 * printed beside it, so the floor costs no honesty.
 */
function slug(fill: number, delay: number): CSSProperties {
	return {
		"--fill": fill > 0 ? Math.max(fill, 0.012) : 0,
		animationDelay: `${delay}ms`,
	} as CSSProperties;
}

const FACE = "absolute inset-0 block bg-[var(--evt,var(--muted-foreground))]";

/** A groove with a slug seated in the part that is true, in the row's own colour. */
export function Meter({
	fill,
	delay = 0,
	className,
}: {
	/** 0 to 1. */
	fill: number;
	/** Stagger, so a strip's meters seat in sequence rather than all at once. */
	delay?: number;
	className?: string;
}) {
	return (
		<span
			aria-hidden
			className={cn(
				"bg-track relative block h-2 overflow-hidden rounded-full",
				className,
			)}
		>
			<span className={cn(FACE, "meter-slug")} style={slug(fill, delay)} />
		</span>
	);
}

/**
 * A slug stood on end, for a distribution across a range.
 *
 * No groove around this one. A milled track only reads as a track while it is thin
 * against its length, and a bucket wide enough to label is not.
 */
export function Column({
	fill,
	delay = 0,
	className,
}: {
	fill: number;
	delay?: number;
	className?: string;
}) {
	return (
		<span aria-hidden className={cn("relative block w-full", className)}>
			<span className={cn(FACE, "meter-column")} style={slug(fill, delay)} />
		</span>
	);
}

/** A measured figure. The data face and tabular numerals, everywhere on both pages. */
export function Reading({
	value,
	size = "text-body",
	className,
}: {
	value: ReactNode;
	size?: string;
	className?: string;
}) {
	return (
		<span className={cn("font-data font-medium tabular-nums", size, className)}>
			{value}
		</span>
	);
}
