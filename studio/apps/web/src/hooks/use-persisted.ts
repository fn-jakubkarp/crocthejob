import { type Dispatch, type SetStateAction, useEffect, useState } from "react";

/** Keys under which the board's view state survives a reload. */
export const LS = {
	visible: "kanban.visibleColumns",
	sorts: "kanban.columnSorts",
	dupes: "kanban.showDuplicates",
	fit: "kanban.fitFilter",
	setup: "kanban.setup",
} as const;

function load<T>(key: string, fallback: T, revive?: (raw: T) => T): T {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return fallback;
		const value = JSON.parse(raw) as T;
		return revive ? revive(value) : value;
	} catch {
		return fallback;
	}
}

/**
 * State mirrored into localStorage. Read on mount, not in an effect, so the first paint
 * is already the stored view. `revive` filters out what no longer parses - a column
 * this build dropped.
 */
export function usePersisted<T>(
	key: string,
	fallback: T,
	revive?: (raw: T) => T,
): [T, Dispatch<SetStateAction<T>>] {
	const [value, setValue] = useState<T>(() => load(key, fallback, revive));

	useEffect(() => {
		localStorage.setItem(key, JSON.stringify(value));
	}, [key, value]);

	return [value, setValue];
}
