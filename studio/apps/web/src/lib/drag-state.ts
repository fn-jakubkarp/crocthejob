/**
 * Drag affordance as DOM attributes, not React state, so a drag re-renders nothing.
 * Styling lives in index.css:
 *
 *   body[data-dragging]        -> every drop zone shows it can receive the card
 *   [data-dragging="true"]     -> the source card shows it is the one moving
 *   [data-seated]              -> the track that just took a card settles once
 *   [data-arrived]             -> the card that just landed
 */

import { DRAG_TYPE } from "@/lib/jobs";

let source: HTMLElement | null = null;
let pending = 0;
let seated: HTMLElement | null = null;
let arrived: HTMLElement | null = null;
let seatTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Chromium rasterises the ghost during dragstart, so restyling in the same tick
 * bakes that look in. Hence the one-frame delay.
 */
export function beginDrag(el: HTMLElement): void {
	source = el;
	if (pending) cancelAnimationFrame(pending);
	pending = requestAnimationFrame(() => {
		pending = 0;
		document.body.dataset.dragging = "true";
		if (source) source.dataset.dragging = "true";
	});
}

/**
 * The bitmap the cursor carries. A clone rather than the live tile: rasterising
 * an open tile hands the browser its `elev-drag` shadow and whatever else the
 * paint bounds pick up around it, which comes out as a square-cornered slab
 * behind a rounded card. The clone is the card and nothing else - no shadow, its
 * own rounding, clipped to it.
 *
 * Returns the node to hand to setDragImage; it removes itself next frame, once
 * the rasterisation has happened.
 */
export function dragGhost(el: HTMLElement, width: number): HTMLElement {
	const ghost = el.cloneNode(true) as HTMLElement;
	// Out of flow and off-screen, but painted: a `display:none` node rasterises
	// to nothing and the browser falls back to its default ghost.
	ghost.style.cssText = `position:fixed;top:0;left:-10000px;width:${width}px;margin:0;box-shadow:none;overflow:hidden;pointer-events:none;transition:none;opacity:1`;
	document.body.append(ghost);
	requestAnimationFrame(() => ghost.remove());
	return ghost;
}

export function endDrag(): void {
	// Cancel an unrun frame, or it re-sets the flag after the drag ended.
	if (pending) {
		cancelAnimationFrame(pending);
		pending = 0;
	}
	delete document.body.dataset.dragging;
	if (source) delete source.dataset.dragging;
	source = null;
}

/**
 * Marks the receiving well and, via `data-key`, the card that landed - without the
 * latter it replays `card-in` instead of `tile-arrive`.
 */
function seat(target: EventTarget | null, key: string): void {
	const zone =
		target instanceof Element ? target.closest("[data-dropzone]") : null;
	if (!(zone instanceof HTMLElement)) return;
	if (seatTimer) clearTimeout(seatTimer);
	// Clear first, or two drops into one well leave the attribute set and the
	// animation never restarts.
	clearSeat();
	seated = zone;
	zone.dataset.seated = "true";
	if (key) markArrival(zone, key, 0);
	seatTimer = setTimeout(clearSeat, 460);
}

function clearSeat(): void {
	seatTimer = null;
	if (seated) delete seated.dataset.seated;
	if (arrived) delete arrived.dataset.arrived;
	seated = null;
	arrived = null;
}

/** Usually in the DOM next frame, but StrictMode can slip one. Three tries. */
function markArrival(zone: HTMLElement, key: string, attempt: number): void {
	requestAnimationFrame(() => {
		const card = zone.querySelector(`[data-key="${CSS.escape(key)}"]`);
		if (card instanceof HTMLElement) {
			arrived = card;
			card.dataset.arrived = "true";
		} else if (attempt < 2) {
			markArrival(zone, key, attempt + 1);
		}
	});
}

// A drag ending on a tab switch can miss dragend, hence the visibility listener.
// Not `window.blur`: Chromium blurs the window handing the pointer to the OS drag
// session, so a blur handler tears the affordance down ~100ms into every drag.
if (typeof document !== "undefined") {
	document.addEventListener("dragend", endDrag, true);
	document.addEventListener(
		"drop",
		(e) => {
			seat(e.target, e.dataTransfer?.getData(DRAG_TYPE) ?? "");
			endDrag();
		},
		true,
	);
	document.addEventListener("visibilitychange", () => {
		if (document.hidden) endDrag();
	});
}
