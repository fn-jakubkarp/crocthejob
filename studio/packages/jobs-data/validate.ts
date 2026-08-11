import {
	type Changes,
	DATE_FIELDS,
	LEGACY_STATUS,
	OUTCOMES,
	STATUSES,
	TEXT_FIELDS,
} from "./schema.ts";
import { NOTES_LIMIT, text, today, URL_LIMIT, URL_SHAPE } from "./values.ts";

const EXPECTED = [
	"status",
	"notes",
	"duplicate_of",
	"outcome",
	"title",
	"company",
	"url",
	...TEXT_FIELDS,
	...DATE_FIELDS.map((d) => d.field),
]
	.map((field) => `\`${field}\``)
	.join(", ");

/**
 * One entry's changes off a request object. Returns a message instead of a value on a
 * wrong shape, so every item is validated before anything is written.
 */
export function readChanges(source: Record<string, unknown>): Changes | string {
	const changes: Changes = {};

	if (source.status !== undefined) {
		if (typeof source.status !== "string") return "`status` must be a string";
		const legacy = LEGACY_STATUS[source.status];
		if (legacy) {
			// Translated, not rejected. `apply` merges the tag, so a caller that only
			// knows the old status cannot wipe an existing set.
			changes.status = legacy.status;
			changes.addOutcome = legacy.outcome;
		} else if (!(STATUSES as readonly string[]).includes(source.status)) {
			return `unknown status "${source.status}"`;
		} else {
			changes.status = source.status;
		}
	}

	if (source.notes !== undefined) {
		if (typeof source.notes !== "string") return "`notes` must be a string";
		if (source.notes.length > NOTES_LIMIT) {
			return `notes longer than ${NOTES_LIMIT} characters`;
		}
		changes.notes = source.notes;
	}

	if (source.duplicate_of !== undefined) {
		if (
			source.duplicate_of !== null &&
			typeof source.duplicate_of !== "string"
		) {
			return "`duplicate_of` must be a key, or null for standalone";
		}
		changes.duplicate_of = source.duplicate_of;
	}

	if (source.outcome !== undefined) {
		if (
			!Array.isArray(source.outcome) ||
			source.outcome.some((tag) => typeof tag !== "string")
		) {
			return "`outcome` must be an array of tags";
		}
		const unknown = (source.outcome as string[]).filter(
			(tag) => !(OUTCOMES as readonly string[]).includes(tag),
		);
		if (unknown.length > 0) {
			return `unknown outcome ${unknown.map((t) => `"${t}"`).join(", ")}`;
		}
		// OUTCOMES order, deduplicated, so the file never carries a tag twice or two
		// orderings of one set.
		changes.outcome = OUTCOMES.filter((tag) =>
			(source.outcome as string[]).includes(tag),
		);
	}

	for (const field of ["title", "company"] as const) {
		if (source[field] === undefined) continue;
		if (typeof source[field] !== "string")
			return `\`${field}\` must be a string`;
		let value: string | null;
		try {
			value = text(source[field]);
		} catch (e) {
			return e instanceof Error ? e.message : String(e);
		}
		if (!value) return `\`${field}\` cannot be emptied`;
		changes[field] = value;
	}

	for (const field of TEXT_FIELDS) {
		if (source[field] === undefined) continue;
		if (typeof source[field] !== "string")
			return `\`${field}\` must be a string`;
		try {
			// "" survives `text` as null and is kept as "", which removes the field.
			changes[field] = text(source[field]) ?? "";
		} catch (e) {
			return e instanceof Error ? e.message : String(e);
		}
	}

	if (source.url !== undefined) {
		if (typeof source.url !== "string") return "`url` must be a string";
		let value: string | null;
		try {
			value = text(source.url, URL_LIMIT);
		} catch (e) {
			return e instanceof Error ? e.message : String(e);
		}
		// Not clearable: the URL is usually the key, and a key whose URL is gone is the
		// one state /scrape cannot reconcile.
		if (!value) return "`url` cannot be emptied";
		if (!URL_SHAPE.test(value)) {
			return "`url` must be an http(s) address";
		}
		changes.url = value;
	}

	for (const { field, ahead } of DATE_FIELDS) {
		if (source[field] === undefined) continue;
		if (typeof source[field] !== "string")
			return `\`${field}\` must be a string`;
		const value = (source[field] as string).trim();
		if (value !== "") {
			const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
			// Round-tripped through Date, so 2026-02-31 is refused, not read back as 03-03.
			const iso =
				m &&
				new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
			if (!iso) return `\`${field}\` must be an ISO date, YYYY-MM-DD`;
			if (!ahead && value > today()) {
				return `\`${field}\` cannot be in the future`;
			}
		}
		changes[field] = value;
	}

	if (Object.keys(changes).length === 0) {
		return `expected at least one of ${EXPECTED}`;
	}
	return changes;
}
