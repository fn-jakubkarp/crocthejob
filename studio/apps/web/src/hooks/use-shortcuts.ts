import { useEffect, useRef } from "react";
import {
	BY_COMBO,
	comboOf,
	MODAL_OPEN,
	type ShortcutId,
	typing,
} from "@/lib/shortcuts";

/**
 * One listener for the whole app, matching against the SHORTCUTS table.
 *
 * The handler map is partial on purpose: App leaves the board's own keys out while
 * another section is up, so `r` on the stats page does nothing rather than reloading a
 * board that is not on screen. An unmapped combo falls through to the browser.
 */
export function useShortcuts(
	handlers: Partial<Record<ShortcutId, () => void>>,
) {
	// The map is a fresh object every render. Held in a ref so the listener is installed
	// once and still calls the current handlers.
	const held = useRef(handlers);
	useEffect(() => {
		held.current = handlers;
	});

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			// Held keys must not spam: `r` down for a second is one reload, not thirty.
			if (e.repeat) return;
			const combo = comboOf(e);
			if (!combo) return;
			// Every binding is a bare key, so anything typed into a field is text.
			if (typing(document.activeElement)) return;
			if (document.querySelector(MODAL_OPEN)) return;

			const id = BY_COMBO.get(combo);
			const run = id && held.current[id];
			if (!run) return;
			e.preventDefault();
			run();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);
}
