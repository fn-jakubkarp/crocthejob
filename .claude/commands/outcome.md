# /outcome - Record the Result of an Application

You are recording what happened to a job application: progress updates (interview invitations, stages completed, offers) and final resolutions (hired, rejected, no response). The data lands in two places the framework already reads but nothing systematically writes:

- `data/jobs.json` - the `status` field that `/scrape` and `/rank` use for dedup and exclusion, and that the kanban board renders
- `documents/applications/<company>_<role>/` - the per-application archive (posting, submitted drafts, `outcome.md`) that `/setup` Path A mines to calibrate `04-job-evaluation.md` and surface STAR candidates

`/outcome` writes the data; `/setup` interprets it. This command never edits the evaluation framework or profile files itself.

The command also owns the stretch *before* there is an outcome to record: the **follow-up branch** (Step 2b) surfaces open applications that have gone quiet, drafts a brief follow-up note in the user's voice, and logs it - so the chase and the resolution it eventually leads to live in one flow.

Follow these steps **in order**.

---

## Step 0: Parse Input

`$ARGUMENTS` may contain:

- Nothing → list open applications and ask which one to update
- `#<id>`, e.g. `/outcome #153` → target that entry. The unambiguous form, and the one the board sends: a company name matches two entries whenever the same employer ran two roles. No entry with that id → say so and stop
- A company name (optionally with a role), e.g. `/outcome acme` or `/outcome acme ml engineer` → target that application
- `followup` → enter the follow-up branch (Step 2b) over every quiet open application, using the default threshold of **10 days**
- `followup <N>`, e.g. `/outcome followup 14` → follow-up branch with an N-day threshold
- `followup <company>` or `followup #<id>`, e.g. `/outcome followup acme` → draft a follow-up for that application now, regardless of threshold

---

## Step 1: Load State and Identify the Application

1. Read `data/jobs.json`. Applications are the entries whose `status` is `applied`, `screening`, `tech_interview`, `final_round`, `offer` or `rejected`.
2. **With `#<id>`:** take the entry whose `id` is that integer, no matching needed. **With a name argument:** match entries case-insensitively on `company` (and `title`, if given). One match → proceed. Several → list them and ask. None → the application was made outside the workflow; collect company, role, date applied, channel, and posting URL from the user and add an entry keyed `manual:<company-slug>:<role-slug>` with `portal: "manual (user)"`, the same shape the board's **Add posting** dialog writes.
3. **Without an argument:** list all entries whose status is open (`applied`, `screening`, `tech_interview`, `final_round`, `offer` - not `rejected`) as a numbered table (company, role, date applied, current status, days quiet, follow-ups sent) and ask which to update. The two derived columns come straight from existing data: **days quiet** counts from the entry's `applied_date`, `status_date` or the latest dated entry in `notes`, whichever is more recent; **follow-ups sent** counts the `followed up YYYY-MM-DD` markers in `notes`. If any open entry is 10+ days quiet with fewer than two follow-ups sent, add one line under the table: "Some of these have gone quiet - want a follow-up draft? (Step 2b)". If every entry is resolved, say so and stop.
4. Derive the archive folder name: `documents/applications/<company>_<role>/` - lowercase, underscores for spaces (the convention documented in `documents/README.md`). Check whether the folder and an `outcome.md` already exist - if so, you are updating, not creating.

---

## Step 2: Collect What Happened

Ask the user what happened, then classify:

**Progress updates** (application still open):
- Interview invitation / stage scheduled or completed (phone screen, technical, case, final round)
- Offer received (not yet accepted or declined)

**Resolutions** (application closed) - these map to the status enum in `documents/README.md` that `/setup` parses:
- `hired` - accepted an offer
- `offer_declined` - received an offer, turned it down
- `rejected` - explicit rejection at any stage
- `no_response` - no reply; if the user is unsure whether to call it, note how long it has been since the last contact and let them decide - do not impose a cutoff
- `interview_only` - reached interviews but the process stalled or was abandoned without an explicit rejection

Also collect, without interrogating - one or two open questions are enough:
- Dates for the stages reached
- Any feedback received, verbatim where the user remembers it
- What they'd do differently, and any signal about what the company valued (these feed `/setup`'s calibration and STAR-candidate mining, so concrete beats polished)

---

## Step 2b: Follow-Up Branch (chase a quiet application)

Enter this branch from the `followup` argument (Step 0) or from the offer under the open-pipeline table (Step 1.3). Standard practice is a brief, polite follow-up one to two weeks after applying, at most twice; this branch operationalizes that.

**Candidates.** An application qualifies when its status is not final, the threshold has passed since its `applied_date` (or since the last `followed up` marker in `notes`, if any), and it has fewer than **two** logged follow-ups. Parse dates defensively - skip entries whose dates do not parse and say so rather than guessing. Present qualifying applications as a table (company, role, days quiet, follow-ups sent, channel, contact person) and draft only for the ones the user picks. Channel and contact person are not fields: read them off `portal` (`manual (user)` means the user logged it themselves) and `notes`.

**Threshold.** The 10-day default is the proactive nudge while a reply is still plausible, not a staleness alarm for a row that has been forgotten entirely. Adjust it per channel if the user asks; a recruiter conversation moves faster than a portal submission.

**Drafting.** For each selected application:

1. Read the archive folder: the `job_posting.md` and tailored CV markdown that Step 3 maintains are the source of **every claim** the note may make - this is Rule 3 (never fabricate) widened to "no new claims": a follow-up that introduces skills or experience the submitted materials don't contain is a fabrication vector.
2. Apply the writing style rules from `03-writing-style.md` (no cliches, no em-dashes, warm but direct), and match the application's language - draw the register from the archived CV.
3. Write roughly **60 to 120 words**: address the contact person by name if the entry's `notes` record one (otherwise the team, in the application's language); one sentence restating interest in the specific role; one concrete value-reminder drawn from the submitted materials; one polite question about the timeline. No pressure, no "just checking in" filler.
4. Shape it for the channel the application came through: email (with a subject line reusing the application's headline), LinkedIn message (shorter, no subject), or portal message (plain text).
5. Present the draft and iterate until the user is happy.

**Logging.** Once the user confirms they will send it (or have sent it), log it in the same turn - an unlogged follow-up breaks the next run's quiet-days math:

- Append `followed up YYYY-MM-DD` to the entry's `notes` (Step 4's rule applies: append a dated note, never restructure the file).
- Save the final note as `followup_YYYY-MM-DD.md` in the application's archive folder. Safe by documented convention: `/setup` reads only the four named archive files and ignores extras (the same rule that covers `/interview`'s prep files).

If the user decides not to send, log nothing.

**Termination.** When an application hits two follow-ups and stays silent, do not offer a third. This is the moment to continue in this same command's Step 2: note how long it has been since last contact and let the user decide whether to record `no_response` - as ever, no imposed cutoff. And if the user mentions an actual response while in this branch (an interview invitation, a rejection), drop out of the branch and record it through the normal Step 2 flow.

---

## Step 3: Archive the Application Materials

Create or update `documents/applications/<company>_<role>/`. All content here is personal data, and the folder is tracked, so it enters the repo's history: nothing is redacted, and the repo stays private, as `CLAUDE.md` requires.

1. **The submitted CV markdown** - copy (never move) the submitted file. Look in `documents/applications/<company>_*/`. Rename the CV to `cv_submitted.md` in the archive so it is unambiguous which version was sent. If a file already exists in the archive, leave it - the archived version is what was actually submitted. If no draft files exist (application made outside `/apply`), skip with a note.
2. **`job_posting.md`** - if it already exists, leave it. Otherwise try WebFetch on the entry's `url` and save the posting text. If the URL is dead (postings expire fast - this is exactly why the archive matters), ask the user to paste the posting, or write a stub noting the posting is unavailable. **Never reconstruct a posting from memory.**
3. **`outcome.md`** - write or update it in exactly the format documented in `documents/README.md`, so `/setup` Path A parses it without special cases:

```markdown
# Outcome: <Company> — <Role>

**Status:** in_progress | hired | offer_declined | rejected | no_response | interview_only

**Date resolved:** YYYY-MM-DD   <- only when resolved; omit while in_progress

## Interview stages reached
- [x] Phone screen (YYYY-MM-DD)
- [ ] Technical interview
- [ ] Case interview
- [ ] Final round
- [ ] Offer received

## Notes
<feedback received, what to do differently, signals about what they valued -
appended per update with a date, never overwritten>
```

Update rules: tick stage checkboxes as they are reached (add the date in parentheses), append dated entries to Notes, and only change `Status` from `in_progress` to a final value on resolution. Re-running `/outcome` on the same application is idempotent - it appends new information, never duplicates or rewrites history.

**Thank-you note trigger:** when this step ticks a newly completed interview stage, offer in the same turn: "Want a short thank-you note for the interviewer? A prompt one is standard practice." If accepted, draft it under Step 2b's drafting and logging rules (same voice, same no-new-claims boundary, same `followup_YYYY-MM-DD.md` archive convention). Recording the stage is the trigger - no scanning for recent stages is ever needed.

---

## Step 4: Update the Entry

Set the matched entry's `status` (`applied` → `screening` → `tech_interview` → `final_round` → `offer` → `rejected`), stamp `status_date` with today's date, and append a short dated note to `notes`. Never restructure the file, reorder entries, or touch other entries.

Stamp the stage's own date field too, with the date Step 2 collected rather than with today's: `screening_date`, `tech_interview_date`, `final_round_date`, `offer_date`, `rejected_date`. `status_date` records when the entry was moved; these record when the stage happened, which is what the board's rail measures the wait between. A stage booked ahead takes its future date here, which is what makes it read as booked rather than as done. No date collected, no write - leave the field absent rather than guessing today.

Set `application_dir` to the archive folder Step 3 created or updated (repo-relative, no trailing slash), unless the entry already carries it. `/apply` writes the same field when it creates the folder; this is the branch for applications made outside that workflow. It is what lets the board show the CV, the prep packs and the outcome on the entry without guessing at a folder name.

**`rejected` is every way an application ends without an offer**, and *which* way is the `outcome` array, not a separate status: `ghosted`, `withdrawn`, `on_hold`, `failed_screening`, `failed_tech`, `failed_behavioural`. They combine - one that went quiet *after* the technical round is `["ghosted", "failed_tech"]`. **An empty or absent `outcome` means they simply said no**, which is a real answer and has no tag of its own.

Leave `rank_score`, `rank_verdict`, `rank_dimensions`, `fit`, `first_seen` and `portal` untouched - they belong to `/scrape` and `/rank`.

---

## Step 5: Calibration Handoff

Count the `outcome.md` files under `documents/applications/` with a **final** status (not `in_progress`).

- If 3 or more are resolved (or 2+ share a pattern - same role type rejected twice, same sector going silent), suggest:
  > "You now have <N> resolved applications on record. Run `/setup` (Path A) to fold them into your evaluation framework - it calibrates fit scoring from what actually got interviews, and mines your interview feedback for STAR examples."
- Do **not** write anything into `04-job-evaluation.md` or other skill files yourself. `/setup` Path A owns that merge - it is read-before-write and idempotent, and duplicating its logic here would race it.

---

## Step 6: Confirm

Summarize what was recorded:

> **Outcome recorded for <Role> at <Company>.**
>
> - `documents/applications/<company>_<role>/outcome.md` - status: <status>, <what changed>
> - Archived: <which of cv_submitted.md / job_posting.md were copied or fetched, and which were skipped and why>
> - `data/jobs.json`: status → <new status>
>
> [Calibration suggestion from Step 5, if triggered]

If the update recorded an upcoming or newly scheduled interview stage, also suggest:

> "Interview coming up? `/interview <company>` builds a prep pack for that stage from this application's archive - the posting, the documents you submitted, and any feedback recorded from earlier rounds."

If the recorded status is `hired`, congratulate the user warmly - this is the moment the whole framework exists for.

---

## Important Rules

1. **Write data, don't interpret it.** The archive and `data/jobs.json` are the outputs; calibration belongs to `/setup`. This command never edits profile or framework files.
2. **The archived version is the submitted version.** Existing files in the application folder are never overwritten by fresher drafts.
3. **Never fabricate.** A dead posting URL gets a user-pasted copy or an explicit "unavailable" stub, not a reconstruction. Feedback is recorded as the user reports it.
4. **Stay schema-compatible.** `outcome.md` follows the format in `documents/README.md` exactly (`in_progress` is the one addition, for open applications); `data/jobs.json` keeps its schema, and only the fields named in Step 4 are yours to write.
5. **Idempotent updates.** Re-running on the same application appends new stages and notes; it never duplicates folders, rows, or history.
6. **Follow-ups: draft only, never send.** The follow-up branch produces text for the user to send themselves. It never emails, messages, or submits anything, and it must not be wired to tools that do.
7. **Follow-ups: no new claims.** Every substantive statement in a follow-up or thank-you note comes from the archived submitted materials. Rule 3 applies with no exceptions.
8. **Maximum two follow-ups per application.** After the second silent follow-up, the honest move is recording the resolution, not persistence.
