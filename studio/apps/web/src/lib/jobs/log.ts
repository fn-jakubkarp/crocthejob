/**
 * The dated log a person keeps inside `notes`.
 *
 * Nothing in the file is a journal, so the running record of one application had
 * nowhere to live and went into the note by hand:
 *
 *     30 Jun: Contacted by Amelia Zawadzka (HR Hints, external agency)
 *     3 Jul: Screening
 *     11 Aug: Jakub called me, apologised for the delay
 *
 * That is already the timeline; it was just never read as one. This parses it back
 * out, and every write here rewrites a single line and leaves every other byte of
 * `notes` alone - the field stays the source of truth, the timeline is its render,
 * and `git diff data/jobs.json` still shows one line moving.
 *
 * The year is the one thing the writer leaves out, so it is inferred: the log is kept
 * append-only, top to bottom, which makes the sequence itself the evidence. Each
 * entry takes the earliest year that keeps it on or after the entry above it, so a
 * `20 Dec` followed by a `5 Jan` rolls into January of the next year without anyone
 * having to say so.
 */

const MONTHS = [
	"jan",
	"feb",
	"mar",
	"apr",
	"may",
	"jun",
	"jul",
	"aug",
	"sep",
	"oct",
	"nov",
	"dec",
];

const SHORT = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

/**
 * `30 Jun: …`, `3 Jul 2026: …`, `2026-08-11: …`, with an optional list marker in
 * front. Group 1 is the marker and indent, kept verbatim on a rewrite; group 2 the
 * date as written; group 3 the words.
 *
 * The day has to lead for a date to be claimed, which is what keeps `Rate: 14-16k`
 * and `Recruiter: Amelia` out: they are prose, and prose is not a log entry.
 */
const ENTRY =
	/^(\s*(?:[-*+]\s*)?)(\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]{3,9}\.?(?:\s+\d{4})?)\s*:[ \t]*(.*)$/;

/** February at its longest: the year is usually not written down to check it against. */
const LENGTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const DAY = 86_400_000;

/** Written by hand, or written as ISO. A new entry matches whichever is already there. */
export type LogStyle = "short" | "iso";

export type LogEntry = {
	/** Index into the note's own lines. What a rewrite addresses, so nothing else moves. */
	line: number;
	/** ISO. Inferred when the entry was written without a year. */
	date: string;
	text: string;
	/** True when the year was inferred rather than written down. */
	inferred: boolean;
};

export type ParsedLog = {
	/** In the order the note lists them, which is the order they were written. */
	entries: LogEntry[];
	/** Every line that is not a dated entry, kept as one block. */
	prose: string;
	style: LogStyle;
};

function utcDay(iso: string): number | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
	if (!m) return null;
	const time = Date.UTC(+m[1], +m[2] - 1, +m[3]);
	// Round-tripped, the way `readChanges` does it: `Date.UTC` rolls 2026-02-30 forward
	// into March rather than refusing it, and a log line silently dated two days off the
	// day somebody typed is worse than one that stays prose.
	return new Date(time).toISOString().slice(0, 10) === iso ? time : null;
}

const startOfToday = (now: Date) =>
	Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

const isoOf = (time: number): string =>
	new Date(time).toISOString().slice(0, 10);

/**
 * The three helpers above stay private here rather than coming from `dates.ts`: the year
 * inference needs raw UTC day numbers to compare candidate years, and every reading in
 * `dates.ts` returns a formatted answer or null. Readings about dates - `daysBetween`,
 * `daysSince` - live there and are imported by whoever needs them.
 */

type Written = { day: number; month: number; year: number | null };

/** The date as the writer left it. Null for anything this does not recognise. */
function readDate(text: string): Written | null {
	const iso = utcDay(text);
	if (iso !== null) {
		const date = new Date(iso);
		return {
			day: date.getUTCDate(),
			month: date.getUTCMonth(),
			year: date.getUTCFullYear(),
		};
	}
	const parts = /^(\d{1,2})\s+([A-Za-z]{3,9})\.?(?:\s+(\d{4}))?$/.exec(text);
	if (!parts) return null;
	const month = MONTHS.indexOf(parts[2].slice(0, 3).toLowerCase());
	const day = Number(parts[1]);
	if (month === -1 || day < 1 || day > LENGTH[month]) return null;
	return { day, month, year: parts[3] ? Number(parts[3]) : null };
}

/**
 * The year nobody wrote down. The log runs down the page in the order it happened,
 * so the entry above is the anchor and this takes the earliest year that stays on or
 * after it.
 *
 * ponytail: an out-of-order log would push an entry a year forward, so a pick past
 * the ceiling falls back to the anchor's own year. Two months of headroom is what
 * lets an interview booked ahead keep the year it belongs to.
 */
function inferYear(written: Written, anchor: number, ceiling: number): number {
	const from = new Date(anchor).getUTCFullYear();
	for (const year of [from, from + 1]) {
		const time = Date.UTC(year, written.month, written.day);
		if (time >= anchor && time <= ceiling) return year;
	}
	return from;
}

/**
 * The log inside a note, and everything in it that is not a log.
 *
 * `since` anchors the first entry - the day the posting turned up, less half a year,
 * because a recruiter's first message can predate the scrape that found the posting.
 */
export function parseLog(
	notes: string | undefined,
	{ since, now = new Date() }: { since?: string; now?: Date } = {},
): ParsedLog {
	const lines = (notes ?? "").split("\n");
	const entries: LogEntry[] = [];
	const prose: string[] = [];
	// The last entry's style, not the commonest: a note's convention is whatever was
	// used most recently, and that is what a new line should match.
	let style: LogStyle = "short";

	const floor = since ? utcDay(since) : null;
	let anchor = (floor ?? startOfToday(now) - 365 * DAY) - 182 * DAY;
	const ceiling = startOfToday(now) + 60 * DAY;

	lines.forEach((raw, line) => {
		const match = ENTRY.exec(raw);
		const written = match ? readDate(match[2]) : null;
		if (!match || !written) {
			prose.push(raw);
			return;
		}
		style = /^\d{4}-/.test(match[2]) ? "iso" : "short";
		const year = written.year ?? inferYear(written, anchor, ceiling);
		const time = Date.UTC(year, written.month, written.day);
		anchor = Math.max(anchor, time);
		entries.push({
			line,
			date: isoOf(time),
			text: match[3].trim(),
			inferred: written.year === null,
		});
	});

	return {
		entries,
		// Only the blank lines the entries left behind are dropped; a paragraph keeps
		// its own line breaks, because someone wrote them.
		prose: prose
			.join("\n")
			.replace(/\n{3,}/g, "\n\n")
			.trim(),
		style,
	};
}

/** `13 Aug` or `2026-08-13`, in whichever style the note already keeps. */
export function stamp(iso: string, style: LogStyle): string {
	if (style === "iso") return iso;
	const day = utcDay(iso);
	if (day === null) return iso;
	const date = new Date(day);
	return `${date.getUTCDate()} ${SHORT[date.getUTCMonth()]}`;
}

/** The note with one line replaced, and every other byte where it was. */
function replace(notes: string, line: number, text: string): string {
	const lines = notes.split("\n");
	if (line < 0 || line >= lines.length) return notes;
	lines[line] = text;
	return lines.join("\n");
}

/** The words of one entry, rewritten. Its marker and its date stay as written. */
export function rewriteEntry(
	notes: string,
	line: number,
	text: string,
): string {
	const lines = notes.split("\n");
	const match = ENTRY.exec(lines[line] ?? "");
	if (!match) return notes;
	return replace(notes, line, `${match[1]}${match[2]}: ${text.trim()}`);
}

/** The date of one entry, rewritten. Its words stay as written. */
export function redateEntry(
	notes: string,
	line: number,
	iso: string,
	style: LogStyle = "short",
): string {
	const lines = notes.split("\n");
	const match = ENTRY.exec(lines[line] ?? "");
	if (!match) return notes;
	return replace(notes, line, `${match[1]}${stamp(iso, style)}: ${match[3]}`);
}

/** One entry dropped. The line goes with it rather than being left blank. */
export function dropEntry(notes: string, line: number): string {
	const lines = notes.split("\n");
	if (line < 0 || line >= lines.length) return notes;
	lines.splice(line, 1);
	return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

/**
 * The note with its prose rewritten, and every dated line left byte for byte where it
 * was.
 *
 * `parseLog` hands the prose back as one block, joined out of whatever sat between the
 * entries, so writing it back has to land in those same lines rather than stacking it
 * on top of the log: a note whose recruiter line sits under two dated entries keeps it
 * there. Prose that has grown past the lines it came from goes on the end, which is
 * where a line typed into this note goes anyway.
 */
export function rewriteProse(
	notes: string | undefined,
	entries: LogEntry[],
	text: string,
): string {
	const lines = (notes ?? "").split("\n");
	const dated = new Set(entries.map((entry) => entry.line));
	// Cleared, not blanked: an empty prose leaves the log and nothing else, rather than
	// the run of empty lines the old prose used to occupy.
	const next = text ? text.split("\n") : [];
	const out: string[] = [];
	let taken = 0;
	lines.forEach((line, i) => {
		if (dated.has(i)) out.push(line);
		else if (taken < next.length) out.push(next[taken++]);
	});
	out.push(...next.slice(taken));
	return out.join("\n");
}

/**
 * A new entry, appended the way it is written by hand - at the end, in the note's own
 * style. Nothing is re-sorted: the file keeps what was typed, and the timeline is
 * where the order is decided.
 */
export function appendEntry(
	notes: string | undefined,
	iso: string,
	text: string,
	style: LogStyle = "short",
): string {
	const line = `${stamp(iso, style)}: ${text.trim()}`;
	const held = (notes ?? "").replace(/\s+$/, "");
	return held ? `${held}\n${line}` : line;
}
