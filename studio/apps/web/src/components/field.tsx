import { cn } from "@/lib/utils";

/**
 * Placeholder for a missing value. Dash for the eye, sentence for the screen reader:
 * `aria-label` on a bare `<span>` is unsupported, a generic role exposing no name.
 */
function Nothing() {
	return (
		<>
			<span aria-hidden="true">-</span>
			<span className="sr-only">not recorded</span>
		</>
	);
}

const missingValue = (children: React.ReactNode) =>
	children === undefined ||
	children === null ||
	children === false ||
	children === "";

/**
 * A read-only value with a legend over it. Rendered even when empty: dropping the
 * fields an entry lacks makes a different panel per entry, and then nothing is where
 * you last saw it. A dash says nobody recorded this, not that it does not apply.
 *
 * `omitEmpty` opts out, for entries so bare the frame is all frame. `numeric` is for
 * measured values only.
 */
export function Field({
	label,
	children,
	numeric,
	wide,
	/** Wrap instead of clip, for unbounded length. */
	wrap,
	omitEmpty,
}: {
	label: string;
	children?: React.ReactNode;
	numeric?: boolean;
	wide?: boolean;
	wrap?: boolean;
	omitEmpty?: boolean;
}) {
	const missing = missingValue(children);
	if (missing && omitEmpty) return null;
	return (
		<div className={cn("min-w-0", wide && "col-span-2")}>
			<p className="legend text-muted-foreground text-legend">{label}</p>
			<p
				className={cn(
					"mt-0.5 text-body",
					wrap ? "text-pretty" : "truncate",
					numeric && !missing && "font-data text-meta tabular-nums",
					missing && "text-muted-foreground/70",
				)}
			>
				{missing ? <Nothing /> : children}
			</p>
		</div>
	);
}
