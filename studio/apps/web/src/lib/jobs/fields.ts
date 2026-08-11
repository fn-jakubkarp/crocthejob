import type { Job } from "./types";

/** /scrape truncates the period to two chars. Anything unmapped prints verbatim. */
const SALARY_PERIOD: Record<string, string> = {
	"/ho": "/h",
	"/da": "/day",
	"/ye": "/yr",
};

export function readableSalary(salary: string): string {
	const tail = salary.slice(-3);
	return SALARY_PERIOD[tail]
		? salary.slice(0, -3) + SALARY_PERIOD[tail]
		: salary;
}

/** Remote days out of a five-day week, as the add dialog offers them. */
export const REMOTE_DAYS = [0, 1, 2, 3, 4, 5] as const;

/**
 * A day count as a `work_mode` string. The field stays free text (/scrape writes
 * whatever the portal said), so the wording matches the scraped vocabulary and the
 * count rides in the parenthetical `readableMode` trims off a card.
 */
export function remoteDaysMode(days: number): string {
	if (days <= 0) return "Onsite";
	if (days >= 5) return "Remote";
	return `Hybrid (${days} day${days === 1 ? "" : "s"} remote)`;
}

/** The inverse, for which button is pressed. Null when there is no day count. */
export function modeRemoteDays(mode: string | undefined): number | null {
	const text = mode?.trim();
	if (!text) return null;
	if (/^onsite$/i.test(text)) return 0;
	if (/^remote$/i.test(text)) return 5;
	const days = /\((\d)\s*days?\s*remote\)/i.exec(text);
	return days ? Number(days[1]) : null;
}

/**
 * `work_mode` is free text: collapse the `X or also-X` join artifact, trim the
 * office list, drop "unconfirmed".
 */
export function readableMode(mode: string | undefined): string | null {
	if (!mode) return null;
	const head = mode.split(" (")[0].trim();
	const joined = /^(.+?) or also-(.+)$/.exec(head);
	const text = joined && joined[1] === joined[2] ? joined[1] : head;
	return !text || text.toLowerCase() === "unconfirmed" ? null : text;
}

/**
 * The office list some portals hang off `work_mode` (`remote (Krakow offices)`, for example).
 * A location, so it belongs in the location field, not glued to the mode.
 */
function modeOffices(mode: string | undefined): string | null {
	const inside = mode ? /\(([^)]+)\)/.exec(mode) : null;
	if (!inside) return null;
	const text = inside[1].trim();
	// `Hybrid (3 days remote)` is this board's own writing, and not a place.
	return !text || /\d\s*days?\s*remote/i.test(text) ? null : text;
}

/**
 * `rank_location` held a verdict before it held a place, and every entry ranked so
 * far carries one. Dropped rather than translated: it says nothing about where.
 */
const LOCATION_VERDICTS = new Set(["PASS", "FLAG", "FAIL"]);

/** Where the job is, from whichever field carries a place. */
export function locationOf(job: Job): string | null {
	const ranked = job.rank_location?.trim();
	if (ranked && !LOCATION_VERDICTS.has(ranked.toUpperCase())) return ranked;
	return modeOffices(job.work_mode);
}
