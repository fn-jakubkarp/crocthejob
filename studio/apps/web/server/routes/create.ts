import type { ServerResponse } from "node:http";
import {
	type JobEntry,
	LEGACY_STATUS,
	MANUAL_PORTAL,
	NOTES_LIMIT,
	STATUSES,
	slug,
	text,
	today,
	URL_LIMIT,
	URL_SHAPE,
} from "@jobsearch/jobs-data";
import {
	assignIds,
	readChanges,
	readJobs,
	serialise,
	writeJobs,
} from "@jobsearch/jobs-data/server";
import type { Connect, Logger } from "vite";
import { json, readBody } from "../http.ts";

/**
 * Entries are keyed by posting URL, which is what /scrape dedupes on, so a URL becomes
 * the key when given. Without one a later scrape makes a second entry; the `manual:`
 * prefix keeps the key from colliding with a URL.
 */
function manualKey(company: string, title: string, url?: string): string {
	if (url) return url;
	return `manual:${slug(company)}:${slug(title)}`;
}

/** A posting added by hand, rather than by /scrape. */
export async function createJob(
	req: Connect.IncomingMessage,
	res: ServerResponse,
	logger: Logger,
): Promise<void> {
	const payload = (await readBody(req)) as Record<string, unknown>;

	const title = text(payload?.title);
	const company = text(payload?.company);
	if (!title || !company) {
		json(res, 400, { error: "`title` and `company` are required" });
		return;
	}

	const rawUrl = text(payload?.url, URL_LIMIT);
	if (rawUrl && !URL_SHAPE.test(rawUrl)) {
		json(res, 400, {
			error: "`url` must be an http(s) address, or left empty",
		});
		return;
	}

	const asked = payload?.status === undefined ? "new" : payload.status;
	// A hand-added prior application often went quiet, so translate a legacy status
	// here too rather than refusing it.
	const legacy = typeof asked === "string" ? LEGACY_STATUS[asked] : undefined;
	const status = legacy ? legacy.status : asked;
	if (
		typeof status !== "string" ||
		!(STATUSES as readonly string[]).includes(status)
	) {
		json(res, 400, {
			error: `unknown status "${String(asked)}"`,
			allowed: STATUSES,
		});
		return;
	}

	const notes = text(payload?.notes, NOTES_LIMIT);
	const workMode = text(payload?.work_mode);
	const salary = text(payload?.salary);
	// Same rule a PATCH uses, so the two paths cannot disagree about a valid date.
	const dated = readChanges({
		applied_date:
			payload?.applied_date === undefined ? "" : payload.applied_date,
	});
	if (typeof dated === "string") {
		json(res, 400, { error: dated });
		return;
	}
	const appliedDate = dated.applied_date || null;
	const key = manualKey(company, title, rawUrl ?? undefined);

	const result = await serialise(async () => {
		const data = await readJobs();
		const clash = data.seen[key];
		if (clash) return { ok: false as const, clash };

		// Field order matches /scrape's, board fields after. No `fit`/`rank_*` — those
		// are /scrape's and /rank's judgements.
		const stamp = today();
		const entry: JobEntry = {
			title,
			company,
			...(rawUrl ? { url: rawUrl } : {}),
			first_seen: stamp,
			status,
			portal: MANUAL_PORTAL,
			...(workMode ? { work_mode: workMode } : {}),
			...(salary ? { salary } : {}),
			...(notes ? { notes } : {}),
			status_date: stamp,
			last_updated: stamp,
			...(appliedDate ? { applied_date: appliedDate } : {}),
			...(legacy ? { outcome: [legacy.outcome] } : {}),
		};
		data.seen[key] = entry;
		// Id in front, so a hand-added posting matches every backfilled one.
		assignIds(data);
		await writeJobs(data);
		return { ok: true as const, entry: data.seen[key] };
	});

	if (!result.ok) {
		json(res, 409, {
			error: "this posting is already on the board",
			key,
			existing: {
				company: result.clash.company ?? null,
				title: result.clash.title ?? null,
				status: result.clash.status ?? null,
			},
		});
		return;
	}

	logger.info(
		`[jobs-api] added by hand: ${company} — ${title} (#${result.entry.id ?? "?"})`,
	);
	json(res, 201, { key, ...result.entry });
}
