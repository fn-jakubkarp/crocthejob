/**
 * What a job entry is, and the rules for reading one. No file access and no Node
 * builtins, so a browser bundle can import this half — the half that touches disk is
 * `@jobsearch/jobs-data/server`.
 */

export { staleAfterMove } from "./apply.ts";
export {
	electCanonical,
	normalizeText,
	roleClusters,
	urlClusters,
} from "./dupes.ts";
export { mergeImport, readImport } from "./import.ts";
export {
	type Changes,
	DATE_FIELDS,
	isManual,
	type JobEntry,
	type JobsFile,
	LEGACY_STATUS,
	MANUAL_PORTAL,
	OUTCOMES,
	PIPELINE,
	STAGE_DATE,
	STATUSES,
	type Status,
	TEXT_FIELDS,
} from "./schema.ts";
export {
	NOTES_LIMIT,
	slug,
	text,
	today,
	URL_LIMIT,
	URL_SHAPE,
} from "./values.ts";
