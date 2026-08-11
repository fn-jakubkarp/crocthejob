/**
 * Every keyboard shortcut in the app, once.
 *
 * This table is the binding *and* the help panel: `use-shortcuts` matches events
 * against `combos` and `shortcuts-dialog` prints the same rows, so a key that works
 * and a key that is documented cannot drift apart. Adding one means adding a row here
 * and a handler in App, and the panel updates itself.
 *
 * A combo is written the way `e.key` reports it, which is the one normalisation the
 * platform already does for us: shift is folded into the character it produces (`C`,
 * `?`), so nothing here has to model modifier order. Only `mod` is spelled out, since
 * ⌘ and Ctrl are the same intent on two platforms.
 */

export type ShortcutId =
	| "search"
	| "add"
	| "reload"
	| "columnsAll"
	| "columnsReset"
	| "help"
	| "board"
	| "stats"
	| "history"
	| "chat"
	| "docs";

/** Where a shortcut is printed in the panel, and the order the groups appear in. */
export type Group = "Board" | "Go to" | "Anywhere";

export type Shortcut = {
	id: ShortcutId;
	/** Every combo that fires it. Two mean two ways to reach one action. */
	combos: string[];
	label: string;
	group: Group;
};

export const SHORTCUTS: Shortcut[] = [
	{
		id: "search",
		combos: ["/", "k"],
		label: "Filter the board",
		group: "Board",
	},
	{ id: "add", combos: ["n"], label: "Add a posting", group: "Board" },
	{ id: "reload", combos: ["r"], label: "Reload from disk", group: "Board" },
	{
		id: "columnsAll",
		combos: ["c"],
		label: "Show every column",
		group: "Board",
	},
	{
		id: "columnsReset",
		combos: ["C"],
		label: "Reset columns to default",
		group: "Board",
	},
	{ id: "board", combos: ["1"], label: "Board", group: "Go to" },
	{ id: "stats", combos: ["2"], label: "Stats", group: "Go to" },
	{ id: "history", combos: ["3"], label: "History", group: "Go to" },
	{ id: "chat", combos: ["4"], label: "Chat", group: "Go to" },
	{ id: "docs", combos: ["5"], label: "Docs", group: "Go to" },
	{
		id: "help",
		combos: ["?"],
		label: "This panel",
		group: "Anywhere",
	},
];

export const GROUPS: Group[] = ["Board", "Go to", "Anywhere"];

/** Combo to action. Built once: the listener runs on every keystroke in the app. */
export const BY_COMBO = new Map<string, ShortcutId>(
	SHORTCUTS.flatMap((s) => s.combos.map((combo) => [combo, s.id] as const)),
);

/**
 * The event as this table writes it, or null for anything that cannot be a shortcut.
 *
 * `e.key` already carries shift in the character - `C` for shift+c, `?` for shift+/ -
 * so the only thing folded here is ⌘/Ctrl, and a mod combo is lowercased so caps lock
 * cannot break it.
 */
export function comboOf(e: {
	key: string;
	metaKey: boolean;
	ctrlKey: boolean;
	altKey: boolean;
}): string | null {
	if (e.altKey) return null;
	const mod = e.metaKey || e.ctrlKey;
	return mod ? `mod+${e.key.toLowerCase()}` : e.key;
}

/**
 * A combo as keycaps to print, e.g. `⌘` `K`. Split rather than one string so each cap
 * gets its own box.
 */
export function caps(combo: string, mac: boolean): string[] {
	if (combo.startsWith("mod+"))
		return [mac ? "⌘" : "Ctrl", combo.slice(4).toUpperCase()];
	// A bare capital can only have come from shift, since `e.key` folds it in.
	if (/^[A-Z]$/.test(combo)) return ["⇧", combo];
	return [combo.length === 1 ? combo.toUpperCase() : combo];
}

/**
 * Whether the keystroke belongs to whatever has focus. A bare letter is a shortcut
 * everywhere except inside something that takes text, where it is the text.
 */
export function typing(el: Element | null): boolean {
	if (!(el instanceof HTMLElement)) return false;
	return el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName);
}

/**
 * Anything modal that has taken the keyboard: a dialog, a dropdown, a popover, a
 * select. Read off the DOM rather than threaded through as state - every one of these
 * is a portal outside the React tree that opened them, and the alternative is every
 * menu in the app reporting up to App just so `n` can stand down.
 */
export const MODAL_OPEN =
	"[role=dialog],[role=alertdialog],[role=menu],[role=listbox]";
