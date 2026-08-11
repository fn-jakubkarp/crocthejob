import { canonicalOf } from "./duplicates.ts";
import {
	type Changes,
	DATE_FIELDS,
	type JobEntry,
	OUTCOMES,
	PIPELINE,
	STAGE_DATE,
	TEXT_FIELDS,
} from "./schema.ts";
import { today } from "./values.ts";

/**
 * What a move to `status` makes false, as field names. The file records stages by
 * writing dates and never unwrites them, so without this a card dragged one column too
 * far keeps its stage date after being dragged back - and the history page and the
 * stats funnel both read those dates as evidence the stage happened.
 *
 * Only a move onto the pipeline clears anything. `skipped` is not on it: passing over an
 * application that really did go out must not erase that it went out.
 *
 * Pure and exported, so the board can name what a write will clear without restating
 * the rule.
 */
export function staleAfterMove(
	entry: JobEntry,
	status: string,
	changes?: Changes,
): string[] {
	const rank = (PIPELINE as readonly string[]).indexOf(status);
	if (rank === -1) return [];

	const stale: string[] = [];
	for (const [stage, field] of Object.entries(STAGE_DATE)) {
		if ((PIPELINE as readonly string[]).indexOf(stage) <= rank) continue;
		// A field this same write sets explicitly is the edit dialog correcting the
		// entry by hand, which outranks anything inferred from the move.
		if (changes?.[field as keyof Changes] !== undefined) continue;
		if (entry[field]) stale.push(field);
	}

	// A live entry is not a closed one, so the rejection goes whichever stage it
	// lands on - including back into intake.
	if (entry.rejected_date && changes?.rejected_date === undefined) {
		stale.push("rejected_date");
	}
	if (entry.outcome?.length) stale.push("outcome");

	return stale;
}

/**
 * Whether a `url` change also re-keys the entry. Entries are keyed by posting URL,
 * which is what /scrape dedupes on, so without the re-key the next scrape re-adds
 * the corrected posting. A `manual:` key stays as it is.
 */
export function rekeyTarget(
	entry: JobEntry,
	key: string,
	url: string,
): string | null {
	return entry.url === key && url !== key ? url : null;
}

/**
 * Drops an entry from the file. Returns the keys of the copies it was holding, which
 * are put back on the board as standalone rather than left pointing at a key that has
 * gone - a dangling `duplicate_of` reads as "not yet judged" and the suggestion comes
 * back on the next load.
 *
 * Only hand-added entries are ever deleted: a scraped posting removed here returns on
 * the next /scrape, so the caller checks that before calling.
 */
export function remove(seen: Record<string, JobEntry>, key: string): string[] {
	const freed: string[] = [];
	for (const [otherKey, other] of Object.entries(seen)) {
		if (other.duplicate_of !== key) continue;
		other.duplicate_of = null;
		other.last_updated = today();
		freed.push(otherKey);
	}
	delete seen[key];
	return freed;
}

/**
 * Records a hand-saved posting copy. The caller writes the file itself - jobs-data
 * never touches `documents/` - and passes the path back here once it exists. Refuses
 * a copy already on file rather than overwrite it, since the caller has by then
 * already written a second file nothing will point at.
 */
export function savePosting(
	seen: Record<string, JobEntry>,
	key: string,
	relPath: string,
): boolean {
	const entry = seen[key];
	if (!entry || entry.posting_file) return false;
	entry.posting_file = relPath;
	entry.last_updated = today();
	return true;
}

/**
 * Applies one entry's changes in place and lists what moved; an empty list means no
 * file write. Mutates the entry, so a held reference survives a re-key - `seen[key]`
 * does not.
 */
export function apply(
	seen: Record<string, JobEntry>,
	key: string,
	changes: Changes,
): string[] {
	const entry = seen[key];
	const moved: string[] = [];

	// An emptied field is removed, not stored as "". `title`/`company` never arrive
	// empty — readChanges refuses that: no company means unfindable on the board.
	for (const field of [
		"title",
		"company",
		...TEXT_FIELDS,
		...DATE_FIELDS.map((d) => d.field),
	] as const) {
		const value = changes[field];
		if (value === undefined) continue;
		if (value === (entry[field] ?? "")) continue;
		if (value === "") delete entry[field];
		else entry[field] = value;
		moved.push(`${field} -> ${value || "(removed)"}`);
	}

	if (changes.url !== undefined && changes.url !== (entry.url ?? "")) {
		const rekey = rekeyTarget(entry, key, changes.url);
		entry.url = changes.url;
		moved.push(`url -> ${changes.url}`);
		if (rekey) {
			delete seen[key];
			seen[rekey] = entry;
			// Copies point at the old key; a dangling pointer puts each back on the
			// board as a separate posting.
			for (const other of Object.values(seen)) {
				if (other.duplicate_of === key) other.duplicate_of = rekey;
			}
			moved.push(`key -> ${rekey}`);
		}
	}

	if (changes.status !== undefined) {
		const previous = entry.status ?? null;
		if (changes.status !== previous) {
			entry.status = changes.status;
			// The stamp ages a live application. Written on change, not backfilled, so an
			// entry predating the field falls back to `first_seen` instead of claiming today.
			entry.status_date = today();
			moved.push(`status ${previous} -> ${changes.status}`);

			// Above the `outcome` block on purpose: a write carrying both a status and an
			// explicit outcome still ends with the outcome it was given.
			for (const field of staleAfterMove(entry, changes.status, changes)) {
				delete entry[field];
				moved.push(`${field} cleared`);
			}
		}
	}

	// `outcome` replaces the set; `addOutcome` merges one tag in, so translating a
	// legacy `ghosted` cannot drop a `failed_tech` already on the entry.
	let outcome: readonly string[] | undefined = changes.outcome;
	if (changes.addOutcome) {
		const held = new Set(outcome ?? entry.outcome ?? []);
		held.add(changes.addOutcome);
		outcome = OUTCOMES.filter((tag) => held.has(tag));
	}
	if (outcome !== undefined) {
		if (JSON.stringify(outcome) !== JSON.stringify(entry.outcome ?? [])) {
			// An emptied set removes the key rather than storing [].
			if (outcome.length === 0) delete entry.outcome;
			else entry.outcome = [...outcome];
			moved.push(
				outcome.length === 0
					? "outcome cleared"
					: `outcome ${outcome.join("+")}`,
			);
		}
	}

	if (changes.notes !== undefined) {
		if (changes.notes !== (entry.notes ?? "")) {
			// Removed rather than stored as "".
			if (changes.notes.trim() === "") delete entry.notes;
			else entry.notes = changes.notes;
			moved.push("notes");
		}
	}

	if (changes.duplicate_of !== undefined) {
		const target = changes.duplicate_of;
		if (target === null) {
			if (entry.duplicate_of !== null) {
				entry.duplicate_of = null;
				moved.push("duplicate_of -> standalone");
			}
		} else {
			const canonical = canonicalOf(seen, target);
			if (entry.duplicate_of !== canonical) {
				entry.duplicate_of = canonical;
				moved.push(`duplicate_of -> ${canonical}`);
			}
			// Copies follow it up the chain, or the group forks into two canonicals.
			for (const other of Object.values(seen)) {
				if (other.duplicate_of === key) other.duplicate_of = canonical;
			}
		}
	}

	// Every write the board makes, which `status_date` cannot say: a note or a
	// corrected salary moves an entry without moving its status. Stamped here rather
	// than per route, so a single edit, a batch and the duplicate review all get it.
	// Deliberately not in `moved` - it is the stamp on the change, not one of them.
	if (moved.length > 0) entry.last_updated = today();

	return moved;
}
