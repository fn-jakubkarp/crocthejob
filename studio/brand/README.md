# Croc the Job — brand marks

Geometric alligator head in profile under a bent wizard hat. Drawn on the app's
own palette: `--signal` for the head, a deeper indigo for the hat. Straight
segments only, no curves and no gradients, so it stays in the same ruled world
as the board.

The hat is cut out of the head by a mask rather than laid on top of it, which
leaves a 2.5-unit hairline gap between them. That gap is what lets the mark
collapse to a single fill without turning into a blob.

| File | Use |
| --- | --- |
| `mark.svg` | Primary. Jaws open. |
| `mark-mono.svg` | One fill, `currentColor`. Inherits the surrounding text colour. |
| `mark-alt.svg` | Jaws closed. Quieter, for places where the open maw is too loud. |
| `lockup.svg` | Horizontal: mark plus wordmark. 310x96. |
| `lockup-stacked.svg` | Vertical: mark over wordmark. 200x164. |
| `favicon.svg` | Tile. Padded and recoloured for 16-32px, where the bare mark disappears. |

## Colours

| Token | Hex | Where |
| --- | --- | --- |
| `--signal` | `#637aee` | head, jaws |
| deep indigo | `#33419d` | hat, on light surfaces |
| `--signal-ink` | `#8ca5ff` | hat, on near-black surfaces (the favicon uses this) |
| `--foreground` | `#f3f3f5` | wordmark on dark |
| `--card` | `#18191c` | favicon tile, wordmark on light |

## Wordmark

Archivo at `font-stretch: 84%`, weight 650, uppercase, `0.1em` tracking. Same
register as the app's `label` utility, so the lockup and the column headers are
set in one voice.

The lockups use live `<text>`, which resolves against the app's loaded Archivo.
Convert to outlines before handing either file to anything that will not have
that font.

## Clear space and minimum size

Clear space on all sides is the height of the hat's brim. The bare mark holds
down to about 32px; below that use `favicon.svg`.
