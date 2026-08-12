/**
 * The three tracks, and the one rule they share: each one scrolls inside itself so the
 * page does not, which is the board's own topology at a single entry's scale.
 *
 * Its own module for the reason `button-variants.ts` is: a non-component export beside a
 * component costs Fast Refresh the ability to preserve state on edit.
 *
 * The bound has to be declared on every link of the chain - the well is a flex column
 * that hides its overflow, and the region inside it is `min-h-0 flex-1` - or the content
 * grows past the well and paints over whatever the grid put underneath.
 *
 * Below 1101px it all comes apart deliberately: one column, wells sized to their content,
 * and the page itself is the scroller. Two bands were three: at 1024 the three-track
 * promise cannot be kept anyway, and a two-column band left a hole under the narrow
 * track. Three inner scrollbars on a laptop window is three ways to lose your place.
 */

/**
 * `self-start max-h-full` rather than a stretched grid row: an entry with two log lines
 * and no documents was three wells standing 80% empty to the bottom of the window,
 * which is the free space this page was built to use rather than frame. A well is now as
 * tall as what is in it, up to the height it has, and the region inside still scrolls
 * once the content passes that.
 */
export const TRACK =
	"bg-surface border border-border rounded-well flex min-h-0 max-h-full flex-col self-start overflow-hidden p-3 max-[1100px]:overflow-visible";

export const SCROLL =
	"min-h-0 flex-1 overflow-y-auto pr-1 max-[1100px]:overflow-visible max-[1100px]:pr-0";

/**
 * A cap for the two tracks that hold controls rather than prose. In the three-track
 * layout they are 19 and 21rem wide and this does nothing; in one column they would
 * stretch a two-column field grid and a row of six day buttons across the whole window,
 * which is a form pulled out of shape rather than a wider one.
 */
export const NARROW = "max-[1100px]:max-w-[42rem]";

/**
 * Tighter again, for the record. Its two-value plates and its row of six day buttons are
 * drawn for the 19rem track the three-column layout gives them; at 42rem the score and
 * the fit sat at opposite ends of a rule with a hole between them, and one digit got a
 * hundred pixels of button. Nearer the width they were designed at.
 */
export const NARROW_FORM = "max-[1100px]:max-w-[26rem]";
