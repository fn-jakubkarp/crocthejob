# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.2] - 2026-08-13

### Added

- **Job page.** Every tracked entry now opens at full size from its card: the job
  description, the dated log, an editable record, the artifacts produced for it, and the
  actions that apply at its current stage. The card popover keeps the quick look; the
  page is where the posting is read and where a missing one gets typed in.
- **Skill runs from the board.** `/rank`, `/research`, `/apply`, `/interview` and
  follow-up can be started on an entry from the job page, with the run's output streamed
  back into the panel. `server/run-api.ts` spawns `claude` at the repo root under
  `--permission-mode dontAsk` with an explicit allowlist, writes scoped to
  `documents/` and `data/jobs.json`, and Bash denied outright, because a job description
  is untrusted text that lands in every one of those prompts.
- **`/research`.** Standalone company research on one tracked posting, writing the
  Company Research Checklist result to the application archive so `/apply` and
  `/interview` stop repeating the work.
- **`#<id>` targeting.** `/apply`, `/interview`, `/outcome` and `/research` accept
  `#153` and take that entry from `data/jobs.json` directly. A company name matches two
  entries whenever the same employer ran two roles; the id never does.
  `/interview --stage <status>` takes the stage from the column the card sits in.
- **`application_dir` on the entry.** `/apply` and `/outcome` write the application
  folder back to `data/jobs.json`, so the board lists the CV, the prep packs and the
  outcome without guessing at a folder name. Read-only on the board side.
- **Timeline and log parsing.** `lib/jobs/log.ts` reads the dated lines a person already
  keeps inside `notes` as a real log, inferring the omitted year from the append-only
  order, and rewrites a single line on a write so `git diff data/jobs.json` still shows
  one line moving. `lib/jobs/timeline.ts` reconstructs one entry's run from the dates it
  carries, leaving undated stages out rather than interpolating them.
- **Schema dialog.** The job entry schema, readable from the rail.
- **Setup wizard and jobs file import**, so an existing `jobs.json` can be brought in
  rather than retyped.

### Changed

- **Setup is a section, not a dialog.** The first run is the same sheet the rail returns
  to, so the screen everybody learns setup on is the screen they see again.
- Application folders are lowercase with underscores (`documents/applications/<company>_<role>/`)
  everywhere, one convention across `/apply`, `/outcome` and `/interview`.
- Documentation now states that `documents/applications/**` is tracked rather than
  gitignored: the packs are personal data in the repo's history, and the repo stays
  private.
- `Escape` returns from a job page to the board.

### Fixed

- **A skill run denies by default for real.** `run-api.ts` passes
  `--permission-mode dontAsk` rather than `manual`, which is an alias for `default` and
  asks: under `-p` there was nobody to answer, so it denied by accident rather than by
  rule. The endpoint also refuses a body that is not an object instead of throwing, looks
  a command up by own key only, and never ends a response the stream already ended.
- **`/rank #<id>` cannot overwrite an application.** Scoring an entry at `applied`,
  `screening`, `tech_interview`, `final_round`, `offer` or `rejected` writes the `rank_*`
  fields and leaves the status where it is.
- **`/outcome` knows `final_round`**, and stamps the stage's own date field
  (`screening_date` through `rejected_date`) beside `status_date`, off the date it
  collected rather than off today.
- **The application folder is derived safely.** Company and role are read off an
  untrusted posting, so each is reduced to `a-z0-9_` and the result has to sit directly
  under `documents/applications/`. An imported entry carrying anything else has the field
  dropped.
- **The dated log reads dates that exist.** `2026-02-30` stays prose instead of being
  read back as March 2, and editing the standing note now leaves every dated line byte
  for byte where it was instead of lifting the prose above the log.
- **Job page details.** The spinner marks the command that is running rather than every
  button the run disabled; the document reader clears the last file before loading the
  next and renders prose only on a successful read; the calendar refuses a stored value
  that is not a date; the transcript announces its new lines; copying reports failure
  where the Clipboard API is absent; a refused run no longer reloads the board.

### Removed

- **Chat page.** A chat pane detached from any entry answered questions about nothing in
  particular. The run panel on the job page replaces it, attached to the posting it is
  about.
- The setup wizard dialog, folded into the setup section.

## [0.0.1] - 2026-08-12

Initial release.

- Portal search CLIs: LinkedIn, freehire, and three Polish boards, plus `/add-portal` to
  scaffold a skill for any other board.
- `/scrape`, `/rank`, `/apply`, `/interview`, `/outcome`, `/setup`, `/expand`, `/upskill`,
  `/reset`.
- The board: nine columns over `data/jobs.json`, drag to change status, notes saved to
  the entry, plus a stats page, a history timeline and a docs reader.
- `@jobsearch/jobs-data`: what a job entry is, what a write may say, and the only code
  that opens `data/jobs.json`.

[0.0.2]: https://github.com/fn-jakubkarp/crocthejob/releases/tag/v0.0.2
[0.0.1]: https://github.com/fn-jakubkarp/crocthejob/releases/tag/v0.0.1
