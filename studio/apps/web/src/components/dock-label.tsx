import type { ReactNode } from "react";

/**
 * The half of a dock or rail key that only exists while it is open, hovered or
 * focused. Every key is an icon at rest and a labelled button once you reach for
 * it.
 *
 * The width comes from a `0fr → 1fr` grid track rather than a `max-width`, so the
 * box lands exactly on the label's own width with no measuring and no guessed
 * ceiling. It is a layout animation, which the performance rule would normally
 * forbid; a seven-item dock is small enough to pay for it, and nothing else can
 * morph a box to fit unknown text.
 *
 * Wrap it in a `group/button` (which `buttonVariants` already sets) so it reads
 * the button's own hover, focus and `aria-expanded` state - no React state, and
 * the label opens on exactly the frame the menu does.
 *
 * The rail's own trigger is hover, plus `:has(:focus-visible)` rather than
 * `:focus-within`: a key keeps DOM focus after a click, and plain `focus-within` would
 * hold the whole rail open with the pointer three columns away.
 *
 * A `group/rail` ancestor opens every label under it at once. The dock has none, and
 * wants none: seven keys growing together would double the plate's width over the
 * board. Two stacked keys are the opposite case — one open and one shut reads as the
 * shut one having failed to open.
 */
export function DockLabel({ children }: { children: ReactNode }) {
	return (
		<span className="grid grid-cols-[0fr] transition-[grid-template-columns] duration-200 ease-out group-hover/button:grid-cols-[1fr] group-focus-visible/button:grid-cols-[1fr] group-aria-expanded/button:grid-cols-[1fr] group-hover/rail:grid-cols-[1fr] group-has-[:focus-visible]/rail:grid-cols-[1fr] motion-reduce:transition-none">
			{/* The clip is its own element and carries no padding of its own: padding on
			    a grid item survives a zero track, and would leave the key a few pixels
			    wider at rest with the glyph off centre. */}
			<span className="overflow-hidden">
				{/* The text fades in a beat behind the box and out ahead of it: revealed
				    at the same rate it would smear across the two frames where the box
				    is still too narrow to hold it. */}
				<span className="flex items-center gap-1.5 pl-1.5 whitespace-nowrap opacity-0 transition-opacity duration-100 ease-out group-hover/button:opacity-100 group-hover/button:delay-75 group-hover/button:duration-150 group-focus-visible/button:opacity-100 group-focus-visible/button:delay-75 group-focus-visible/button:duration-150 group-aria-expanded/button:opacity-100 group-aria-expanded/button:delay-75 group-aria-expanded/button:duration-150 group-hover/rail:opacity-100 group-hover/rail:delay-75 group-hover/rail:duration-150 group-has-[:focus-visible]/rail:opacity-100 group-has-[:focus-visible]/rail:delay-75 group-has-[:focus-visible]/rail:duration-150 motion-reduce:transition-none">
					{children}
				</span>
			</span>
		</span>
	);
}
