/**
 * One import surface for everything the board knows about an entry. Split by subject,
 * not by kind:
 *
 *  - `types` — the stored entry, and what the board may write to it
 *  - `status` / `columns` — the pipeline, and which column a status lands in
 *  - `outcomes` — how an application ended
 *  - `dates` — every reading taken off an ISO date
 *  - `history` — those dates read back as the run of the search, day by day
 *  - `fields` — free-text fields the portals wrote, made readable
 *  - `scoring` / `sort` — /rank's verdict, and column order
 *  - `stats` — every reading the stats page takes off the whole file
 *  - `duplicates` — the same posting under two keys
 *  - `api` — the four calls against /api/jobs
 */
export * from "./api";
export * from "./columns";
export * from "./dates";
export * from "./drag";
export * from "./duplicates";
export * from "./fields";
export * from "./history";
export * from "./outcomes";
export * from "./scoring";
export * from "./sort";
export * from "./stats";
export * from "./status";
export * from "./types";
