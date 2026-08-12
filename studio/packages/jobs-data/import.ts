/**
 * Reading a jobs file somebody else exported, and folding it into this one. Data only:
 * the route owns the HTTP shape, `store.ts` owns the file.
 *
 * An import is additive. An entry already on the board is left exactly as it is, because
 * the board's copy has the stages, notes and outcomes typed into it and the imported one
 * is a snapshot of some other day.
 */

import { type JobEntry, type JobsFile, STATUSES } from "./schema.ts";
import { slug } from "./values.ts";

/** Keys that would reach `Object.prototype` if assigned onto `seen`. */
const BLOCKED = ["__proto__", "constructor", "prototype"];

const isEntry = (value: unknown): value is JobEntry =>
	!!value && typeof value === "object" && !Array.isArray(value);

/**
 * The key an entry arriving without one is filed under - the posting URL, which is what
 * /scrape dedupes on, and otherwise the same `manual:` key a hand-added posting gets.
 */
function keyOf(entry: JobEntry): string | null {
	if (typeof entry.url === "string" && entry.url) return entry.url;
	const company = typeof entry.company === "string" ? entry.company : "";
	const title = typeof entry.title === "string" ? entry.title : "";
	if (!company && !title) return null;
	return `manual:${slug(company)}:${slug(title)}`;
}

/**
 * Entries off whatever was handed over: a whole jobs file (`{ seen }`), a bare `seen`
 * map, or an array of postings. Returns a message rather than throwing, so the route can
 * answer with something a person can act on.
 */
export function readImport(
	payload: unknown,
): Record<string, JobEntry> | string {
	const wrapped = isEntry(payload) && isEntry((payload as JobsFile).seen);
	const source = wrapped ? (payload as JobsFile).seen : payload;

	if (Array.isArray(source)) {
		const out: Record<string, JobEntry> = {};
		for (const item of source) {
			if (!isEntry(item)) continue;
			const key = keyOf(item);
			if (key) out[key] = item;
		}
		return out;
	}

	if (!isEntry(source)) {
		return "expected a jobs file with a `seen` object, or an array of postings";
	}
	return source as Record<string, JobEntry>;
}

/**
 * Everything the file did not already hold, merged in. Entries keep whatever /scrape and
 * /rank wrote them, minus the id: ids are this file's own numbering, so an imported one
 * would collide with an entry that is already using it. `assignIds` hands out fresh ones
 * after the merge.
 */
export function mergeImport(
	data: JobsFile,
	incoming: Record<string, JobEntry>,
): { added: number; skipped: number; dropped: number } {
	let added = 0;
	let skipped = 0;
	let dropped = 0;

	for (const [key, entry] of Object.entries(incoming)) {
		if (!key || BLOCKED.includes(key) || !isEntry(entry)) {
			dropped++;
			continue;
		}
		// `hasOwn`, not a truthiness check: `seen["toString"]` finds the prototype's.
		if (Object.hasOwn(data.seen, key)) {
			skipped++;
			continue;
		}

		const { id, ...rest } = entry;
		for (const blocked of BLOCKED) delete rest[blocked];
		// A status this build does not know would land the card in no column at all, so
		// it comes in as new rather than as nothing.
		const status =
			typeof rest.status === "string" &&
			(STATUSES as readonly string[]).includes(rest.status)
				? rest.status
				: "new";

		data.seen[key] = { ...rest, status };
		added++;
	}

	return { added, skipped, dropped };
}
