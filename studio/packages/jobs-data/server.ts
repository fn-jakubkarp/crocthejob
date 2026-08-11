/**
 * Reading and writing `data/jobs.json`, and everything a write has to decide before it
 * lands. Node only — this half owns the file, so a browser bundle imports
 * `@jobsearch/jobs-data` instead.
 *
 * Split by job rather than layer: `store.ts` owns the file and the write queue,
 * `validate.ts` what a request may say, `apply.ts` what a change does to an entry,
 * `ids.ts` the number an entry is named by, `duplicates.ts` which copy stays.
 */

export { apply, rekeyTarget, remove, savePosting } from "./apply.ts";
export { canonicalOf, linkCertainDuplicates } from "./duplicates.ts";
export { assignIds } from "./ids.ts";
export { JOBS_FILE, readJobs, serialise, writeJobs } from "./store.ts";
export { readChanges } from "./validate.ts";
