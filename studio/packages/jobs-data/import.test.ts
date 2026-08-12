import { expect, test } from "bun:test";
import { mergeImport, readImport } from "./import.ts";
import type { JobsFile } from "./schema.ts";

/**
 * The import is the one path where a file the board did not write reaches `seen`. What
 * can break silently: an entry overwriting one the board has been keeping stages on, and
 * a key that assigns onto the prototype instead of into the map. Run with `bun test`.
 */

test("reads a whole jobs file, a bare map, and an array", () => {
	const entry = { title: "QA Engineer", company: "Acme" };

	expect(readImport({ next_id: 4, seen: { k: entry } })).toEqual({ k: entry });
	expect(readImport({ k: entry })).toEqual({ k: entry });
	// No url, so it keys the way a hand-added posting does.
	expect(readImport([entry])).toEqual({ "manual:acme:qa-engineer": entry });
	expect(readImport([{ ...entry, url: "https://acme.test/1" }])).toEqual({
		"https://acme.test/1": { ...entry, url: "https://acme.test/1" },
	});
	expect(readImport("nope")).toBe(
		"expected a jobs file with a `seen` object, or an array of postings",
	);
});

test("an entry already on the board is left alone", () => {
	const file: JobsFile = {
		seen: { k: { title: "QA Engineer", company: "Acme", status: "offer" } },
	};
	const counts = mergeImport(file, {
		k: { title: "QA Engineer", company: "Acme", status: "new" },
		other: { title: "SDET", company: "Acme", status: "ranked" },
	});

	expect(counts).toEqual({ added: 1, skipped: 1, dropped: 0 });
	expect(file.seen.k.status).toBe("offer");
	expect(file.seen.other.status).toBe("ranked");
});

test("ids are dropped, unknown statuses land in new, prototype keys are refused", () => {
	const file: JobsFile = { seen: {} };
	// Parsed, not written as a literal: `__proto__` in an object literal sets the
	// prototype instead of becoming a key, and the key is what the import has to survive.
	const counts = mergeImport(
		file,
		JSON.parse(`{
			"a": { "title": "SDET", "company": "Acme", "id": 7, "status": "interviewing" },
			"__proto__": { "title": "Nope", "company": "Nope" },
			"b": null
		}`),
	);

	expect(counts).toEqual({ added: 1, skipped: 0, dropped: 2 });
	expect(file.seen.a.id).toBeUndefined();
	expect(file.seen.a.status).toBe("new");
	expect(Object.getPrototypeOf(file.seen)).toBe(Object.prototype);
	expect(Object.hasOwn(file.seen, "__proto__")).toBe(false);
});
