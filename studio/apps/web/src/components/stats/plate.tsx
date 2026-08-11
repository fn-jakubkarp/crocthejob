import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A raised instrument plate. Nothing on the stats page floats free of one.
 *
 * The board is recessed wells holding raised cards. This page inverts that: raised
 * plates with the readings milled *into* them, which is what `--track` was defined
 * for and the one surface plane the board never uses. What is drawn in those grooves
 * is coloured by the timeline's own eight hues, so a stage is the same colour here as
 * on the day it happened.
 */
export function Plate({
	title,
	reading,
	className,
	children,
}: {
	title: string;
	/** The plate's own total, stated where a chart legend would otherwise go. */
	reading?: ReactNode;
	className?: string;
	children: ReactNode;
}) {
	return (
		<section
			className={cn(
				// `min-h-0 overflow-hidden`: the page hands each plate a share of the window,
				// and a plate is what stops its own content from pushing that share open.
				"bg-card border border-border rounded-well flex min-h-0 flex-col overflow-hidden p-3.5 sm:p-4",
				className,
			)}
		>
			<header className="mb-3 flex shrink-0 items-baseline gap-3">
				<h2 className="label text-ink-2 text-body">{title}</h2>
				{reading && (
					<span className="legend text-muted-foreground ml-auto shrink-0 text-legend tabular-nums">
						{reading}
					</span>
				)}
			</header>
			{children}
		</section>
	);
}
