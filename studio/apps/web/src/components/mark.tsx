import { cn } from "@/lib/utils";

/**
 * The product mark: an alligator head in profile under a bent wizard hat, drawn
 * from straight segments only so it sits in the same ruled world as the board.
 * Four planes - cone, brim, upper jaw with the eye knocked out by `evenodd`,
 * lower jaw.
 *
 * One fill on `currentColor` rather than the two-tone artwork in `studio/brand`.
 * The rail's rule is that signal is spent on selection, focus and the drop
 * target; a permanently lit indigo mark at the top of it would make those three
 * read as ordinary. Ink is what is left, and the mark was drawn to survive it.
 *
 * That survival is the mask: the head is cut by the hat dilated 2.5 units, so a
 * hairline of ground runs between them. Stacked instead of cut, a single fill
 * welds the brim to the skull and the silhouette stops being a gator.
 *
 * Holds down to about 28px. Below that use `brand/favicon.svg`, which is the
 * same drawing padded into a tile.
 */
export function Mark({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 128 128"
			className={cn("shrink-0", className)}
			role="img"
			aria-label="Croc the Job"
		>
			<mask
				id="mark-cut"
				maskUnits="userSpaceOnUse"
				x="-40"
				y="-40"
				width="208"
				height="208"
			>
				<rect x="-40" y="-40" width="208" height="208" fill="#fff" />
				{/* Dilating the hat by half the stroke is what opens the gap. Drawn in
				    black on the white field, so it subtracts. */}
				<g fill="#000" stroke="#000" strokeWidth="5" strokeLinejoin="round">
					<path d="M18 63.5 L28 13.7 L8 2 L44 10.3 L58 55 Z" />
					<path d="M0.9 72.5 L7.5 65 L64 53 L71.8 57.4 L64 65.2 L10 76.7 Z" />
				</g>
			</mask>
			<g fill="currentColor">
				<g mask="url(#mark-cut)">
					<path
						fillRule="evenodd"
						d="M14 74 L30 70 L46 66 L58 70 L106 73 L116 79 L108 84 L100.5 92 L93 84 L85.5 92 L78 84 L70.5 92 L63 84 L55.5 92 L48 84 L30 88 L12 92 Z M33 76 L45 80 L33 84 Z"
					/>
					<path d="M16 95 L30 98.8 L37.5 92.8 L45 102.9 L52.5 96.9 L60 106.9 L67.5 100.9 L75 110.9 L82.5 105 L90 115 L98 118 L90 123 L20 102 Z" />
				</g>
				<path d="M18 63.5 L28 13.7 L8 2 L44 10.3 L58 55 Z" />
				<path d="M0.9 72.5 L7.5 65 L64 53 L71.8 57.4 L64 65.2 L10 76.7 Z" />
			</g>
		</svg>
	);
}
