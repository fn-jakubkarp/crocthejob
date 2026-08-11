/** Field-level readers and limits, shared by the validator and the create route. */

export const NOTES_LIMIT = 20_000;

const FIELD_LIMIT = 500;

export const URL_LIMIT = 2_000;

export const URL_SHAPE = /^https?:\/\/\S+$/i;

/** Local date, not UTC — `first_seen` is a diary date. */
export function today(): string {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function slug(value: string): string {
	return value
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/** Trims, collapses whitespace, and drops the field entirely when empty. */
export function text(value: unknown, limit = FIELD_LIMIT): string | null {
	if (typeof value !== "string") return null;
	const clean = value.replace(/\s+/g, " ").trim();
	if (!clean) return null;
	if (clean.length > limit)
		throw new Error(`field longer than ${limit} characters`);
	return clean;
}
