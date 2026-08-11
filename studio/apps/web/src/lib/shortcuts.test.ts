import { expect, test } from "bun:test";
import { BY_COMBO, caps, comboOf, GROUPS, SHORTCUTS } from "./shortcuts";

/**
 * What can break silently here is the shift folding: `e.key` reports `C` for shift+c and
 * `?` for shift+/, so a table that spelled either as `shift+c` would document a key that
 * never fires. Run with `bun test`.
 */

const press = (
	key: string,
	mods: Partial<Record<"meta" | "ctrl" | "alt", boolean>> = {},
) =>
	comboOf({
		key,
		metaKey: mods.meta ?? false,
		ctrlKey: mods.ctrl ?? false,
		altKey: mods.alt ?? false,
	});

test("shift arrives as the character it produces, not as a modifier", () => {
	expect(press("C")).toBe("C");
	expect(press("?")).toBe("?");
	expect(BY_COMBO.get("C")).toBe("columnsReset");
	expect(BY_COMBO.get("?")).toBe("help");
	// The lowercase letter is a different action, and must stay one.
	expect(BY_COMBO.get("c")).toBe("columnsAll");
});

test("the filter is two bare keys, not a mod combo", () => {
	expect(press("/")).toBe("/");
	expect(press("k")).toBe("k");
	expect(BY_COMBO.get("/")).toBe("search");
	expect(BY_COMBO.get("k")).toBe("search");
	expect(BY_COMBO.get("mod+k")).toBeUndefined();
});

test("mod is ⌘ and Ctrl alike, and caps lock cannot break it", () => {
	expect(press("k", { meta: true })).toBe("mod+k");
	expect(press("k", { ctrl: true })).toBe("mod+k");
	expect(press("K", { meta: true })).toBe("mod+k");
});

test("alt is never a shortcut - it composes characters", () => {
	expect(press("n", { alt: true })).toBeNull();
});

test("every combo is bound exactly once", () => {
	const all = SHORTCUTS.flatMap((s) => s.combos);
	expect(all.length).toBe(new Set(all).size);
	expect(BY_COMBO.size).toBe(all.length);
});

test("every shortcut lands in a group the panel prints", () => {
	for (const s of SHORTCUTS) expect(GROUPS).toContain(s.group);
});

test("caps print as the keys they are", () => {
	expect(caps("mod+k", true)).toEqual(["⌘", "K"]);
	expect(caps("mod+k", false)).toEqual(["Ctrl", "K"]);
	expect(caps("/", true)).toEqual(["/"]);
	expect(caps("k", true)).toEqual(["K"]);
	expect(caps("C", true)).toEqual(["⇧", "C"]);
	expect(caps("n", true)).toEqual(["N"]);
	expect(caps("?", true)).toEqual(["?"]);
	expect(caps("1", true)).toEqual(["1"]);
});
