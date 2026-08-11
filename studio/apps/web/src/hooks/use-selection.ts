import { useCallback, useEffect, useRef, useState } from "react";
import type { Job, Status } from "@/lib/jobs";

export type Selection = {
	keys: Set<string>;
	count: number;
	toggle: (key: string, mode: "toggle" | "range") => void;
	clear: () => void;
};

/**
 * Every key between two cards in the column they share, in its current sort order,
 * or null when no one column holds both.
 */
function rangeKeys(
	columns: Map<Status, Job[]>,
	from: string,
	to: string,
): string[] | null {
	for (const list of columns.values()) {
		const a = list.findIndex((j) => j.key === from);
		const b = list.findIndex((j) => j.key === to);
		if (a === -1 || b === -1) continue;
		const keys: string[] = [];
		for (let i = Math.min(a, b); i <= Math.max(a, b); i++)
			keys.push(list[i].key);
		return keys;
	}
	return null;
}

/**
 * Keys picked out across the whole board. A shift-click measures its range against
 * `columns`, so the range follows what is on screen in the order it is on screen.
 */
export function useSelection(columns: Map<Status, Job[]>): Selection {
	const [keys, setKeys] = useState<Set<string>>(() => new Set());
	/** Where a shift-click measures from: the last key toggled on its own. */
	const anchor = useRef<string | null>(null);

	/**
	 * A range extends within the column both cards share. Across two columns it falls
	 * back to a plain toggle.
	 *
	 * Both the anchor read and the anchor write sit out here rather than inside the
	 * updater: React may replay an updater, and under StrictMode does, which would
	 * measure the range from an anchor the replay itself had already moved.
	 */
	const toggle = useCallback(
		(key: string, mode: "toggle" | "range") => {
			const from = anchor.current;
			const range =
				mode === "range" && from && from !== key
					? rangeKeys(columns, from, key)
					: null;

			if (range) {
				// A range leaves the anchor where it was, so the next shift-click still
				// measures from the card the user picked out.
				setKeys((prev) => {
					const next = new Set(prev);
					for (const k of range) next.add(k);
					return next;
				});
				return;
			}

			setKeys((prev) => {
				const next = new Set(prev);
				if (next.has(key)) next.delete(key);
				else next.add(key);
				return next;
			});
			anchor.current = key;
		},
		[columns],
	);

	const clear = useCallback(() => {
		setKeys(new Set());
		anchor.current = null;
	}, []);

	// The popover and dialogs stop Escape first, so this only fires with none open.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") clear();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [clear]);

	return { keys, count: keys.size, toggle, clear };
}
