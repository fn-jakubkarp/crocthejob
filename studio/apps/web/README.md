# Croc the Job — the board

A kanban view over `data/jobs.json`. Move a card between stages and the entry's `status`
is rewritten in that file; notes typed on a card are saved to the same entry. The JSON
stays the single source of truth, so `/scrape` and `/rank` keep working unchanged. No
database.

Reading and writing that file is `packages/jobs-data`, which this app shares with the
rest of the repo; only the HTTP shape lives under `server/`.

```bash
bun install          # from the repo root, once - this is a workspace
bun run dev          # from studio/, or `bun run dev` in apps/web
                     # http://localhost:5173
```

## Using it

- **Move a card three ways.** Drag it to another column, click it and pick a stage in the
  popover, or right-click for **Move to**. All three write the same field.
- **Right-click a card** for open/copy, details, **Edit posting**, the stage submenu, and
  **Skip with a reason…**.
- **Rule a posting out yourself** with **Skip with a reason…**. It asks for a reason, then
  writes `status: skipped` and the reason into `notes` in **one** PATCH — an entry can never
  sit in Skipped by your hand with no explanation attached. `/rank` never re-scores a
  skipped entry, not even with `--all`, so this is how you overrule a score you disagree
  with and have it stay overruled. Dragging a card into the column is the no-reason path.
- **Correct what a posting says** with **Edit posting** — company, title, URL, remote days,
  salary and the date you applied. Fixing the URL of an entry keyed by that URL moves the
  entry to the corrected key, so the next `/scrape` does not add the posting twice.
- **Click a card** for the detail popover: id, score, fit, the rank breakdown, then a
  fixed grid — work mode, salary, location, applied, time in stage, deadline, posted, first
  seen, portal and the two free-text notes `/scrape` and `/rank` leave behind — then the
  link, the stage picker, and a notes box that autosaves ~700 ms after you stop typing.
  **Every entry shows the same panel**: a value the scrapers never found reads as `—`
  rather than being dropped, so the same reading is always on the same line instead of the
  layout reshuffling per card.
- **The popover reads; Edit posting writes.** Everything the board shows about a posting
  is correctable in that one dialog — company, title, URL, work mode, salary, location,
  applied, apply deadline, posted, first seen, portal, stage — and an emptied field deletes
  the key rather than storing `""`. **The score, the verdict and the rank breakdown are
  not editable anywhere**: they are `/rank`'s judgement and the one thing here that cannot
  be reproduced by hand, so they are not a number anyone can type over. `/scrape`'s own
  sentence about the entry (the Scraper note) is read-only for the same reason — your
  version of it goes in Notes, which stay in the popover and autosave.
- **The apply deadline disappears once the application is out.** It is only shown while an
  entry is still being triaged: after that, when applications closed cannot change anything
  you do, and a lapsed date next to a live process reads as bad news about the process.
- **A rejected entry leads with its outcome.** Under Rejected the tags, the stage and the
  notes sit above the details — how it ended is what you open a dead entry to read, and the
  score is what it was before it died. Everywhere else the details lead, because there the
  question is still whether to apply.
- **"In stage" is a wait, not an event.** It reads `since 07-24 · 12d`, from `status_date`.
  It used to print the stage word, which turned a card dragged into Tech interview this
  morning into "interview today" — a scheduled interview, apparently. The stage is already
  named by the column the card sits in.
- **Moving a card into Rejected asks how it ended** — the outcome tags, plus an optional
  note, written with the status in one PATCH. Confirming with nothing ticked is a real
  answer: they simply said no. "Rejected" on its own is the one status that says nothing
  worth having a month later. Cards with a note show a 📄 marker, and the search box
  matches note text and the id (`153` or `#153`).
- **Every posting carries an id** (`#153`), assigned once and never reused, so a card can
  be named in conversation or grepped in the JSON.
- **Duplicates are hidden.** Postings that are the same URL modulo tracking parameters get
  linked on load; the canonical card shows a `×3` chip and lists its copies in the popover,
  where each has an **unhide**. Matches that only share a company and title are riskier —
  the same role in two cities is not one posting — so those queue in **Duplicates → Review**
  and stay visible until you answer. Both answers are saved, so nothing is asked twice.
  **Show the hidden copies** in the same menu puts them back on screen, reading `#153B`.
  Right-clicking a card offers **Mark as a duplicate…** for the ones neither signal catches.
- **A live card drops the deadline** and reports its wait instead (`applied 6d`), which
  lights up past 21 days in a pre-offer stage. Cards that predate the `status_date` field
  fall back to `seen MM-DD`; the deadline itself is still in the popover at every stage.
- **The popover's Location is a place**, not a verdict. `rank_location` used to hold
  `PASS`/`FLAG`/`FAIL`, which threw away the one thing `/rank` learned by reading the
  posting and could not be reconstructed later; it now holds what the posting said
  (`Kraków, hybrid 2 days/week`). The veto still happens at rank time and still lands as
  `skipped` with the reason in `excluded_reason`. Entries ranked before the change
  carry a verdict rather than a place, and the board **ignores** those: "checked — no
  problem" occupied the location line without saying where the job was. An office list some
  portals hang off `work_mode` (`remote (Gdansk/Warszawa/Krakow offices)`) is read as the
  location it is, rather than being printed next to the mode.
- **Select several cards** with ⌘/Ctrl-click, or ⇧-click to take a run within one
  column. A bar appears with the count, **Move to** and **Skip with a reason…**; right-clicking
  any held card offers the same two actions for the whole selection. Escape clears.
  A batch is **one** request and one file write, so it either lands completely or not at
  all — a selection is never left half-moved.
- **Add a posting the scrapers never saw** with **Add**. Company and title are all that
  is required; it lands as `portal: "manual (user)"`, matching the entries already added
  by hand. Give it the posting URL if there is one — that URL is the key `/scrape`
  dedupes on, so without it a later scrape of the same role adds a second entry. There is
  no field for a score or a fit: run `/rank` afterwards to get those honestly. Work mode
  is a five-rung slider — onsite, mostly onsite, hybrid, mostly remote, remote — because
  the answer is one of five things every time and typing "100% remote" was the slowest
  part of the form. Click anywhere on the rail, or use ←/→, Home/End, and Backspace to
  clear. It starts **not set** rather than in the middle: a posting whose mode you do not
  know must not end up claiming Hybrid.
- **Sort each column independently** from the ⇅ button in its header — score, fit,
  deadline, first-seen either way, or company A–Z.
- **Hide columns** with the eye icon in a column header, or from the Columns menu.
  Choices and per-column sorts persist in `localStorage`, not in the JSON.

## How the write path works

There is no separate backend. `server/jobs-api.ts` is a Vite plugin that mounts two
routes on the dev server, so `bun run dev` is the only process to run:

| Route | Does |
| --- | --- |
| `GET /api/jobs` | Returns every entry as `{ key, ...entry }`, plus the allowed statuses. Also backfills missing `id`s and links URL-identical duplicates — idempotent, so it usually writes nothing |
| `PATCH /api/jobs` | Body `{ key \| keys \| edits, status?, notes?, duplicate_of?, outcome?, title?, company?, url?, work_mode?, salary?, applied_date? }`. Reassigns those fields on one entry, a batch taking the same values, or an `edits` array carrying a value per entry |
| `POST /api/jobs` | Body `{ title, company, url?, salary?, work_mode?, applied_date?, notes?, status? }`. Creates one entry |

Constraints, because this reads and writes real tracked data:

- **`PATCH` assigns `status`, `notes`, `duplicate_of` and `outcome`**, plus the
  `status_date` stamp that follows a status change, plus what the edit dialog owns —
  `title`, `company`, `url`, `work_mode`, `salary` and `applied_date`. `rank_score`,
  `rank_verdict`, `rank_date`, `rank_dimensions`, `portal`, `fit`, `first_seen` and
  anything else on the entry are carried through untouched. `/rank` depends on them.
- **Correcting the URL of an entry keyed by that URL moves the entry to a new key**,
  because the key is what `/scrape` dedupes on. Copies pointing at the old key follow it,
  and a URL another entry already holds is refused with a 409 rather than overwriting it.
- **A retired status is translated, not refused.** `ghosted` and `withdrawn` are no longer
  writable, but a PATCH or POST naming one lands as `rejected` carrying the matching tag —
  the tracker and the CLI skills can still produce them. The tag is *merged* into whatever
  the entry already held, so a caller that only knows the old status cannot wipe a
  `failed_tech` you had put there.
- **Six fields are the board's**, and `/scrape` and `/rank` are told to carry them
  through: `next_id` at the file root, and `id`, `status_date`, `applied_date`,
  `duplicate_of` and `outcome` on an entry. `id` is assigned once in `first_seen` order, never reused and never renumbered —
  it is the handle you name a posting by. New fields are written with `id` ahead of
  `title` rather than appended, because appending puts a comma on what used to be the
  entry's last line and doubles the size of a backfill diff.
- **A duplicate keeps its own `id`** and points at its canonical through `duplicate_of`.
  The `#153B` reading on a copy is derived from group order at render time, so
  re-electing a canonical can never renumber anything.
- **`duplicate_of: null` is not the same as absent.** Absent means unjudged; `null` means
  the user read a suggestion and ruled the entry standalone, which is what stops it being
  suggested again.
- **The `edits` array exists for the duplicate review**, where confirming a group writes a
  canonical key to some members and `null` to others in the same all-or-nothing write.
- **Writes are serialised.** A debounced notes save can overlap a drag's status write;
  without a queue, two read-modify-write cycles would lose whichever landed first.
- A skip-with-reason sends `status` **and** `notes` in a single body rather than two
  requests. The queue would serialise two calls anyway, but one call means the entry cannot
  land in `skipped` without its reason — not between two requests, and not at all if the
  second one fails.
- An emptied note deletes the `notes` key rather than storing `""`, so entries you never
  annotated stay clean.
- **Writes are atomic** — temp file in the same directory, then `rename`. An interrupted
  write cannot leave truncated JSON behind.
- **2-space indent**, matching what `/scrape` writes, so a status change is a one-line
  git diff rather than a whole-file reformat.
- **Unknown statuses are rejected** with a 400. A typo'd status would make an entry
  invisible to the dedup logic in `/scrape`.
- **A batch resolves every key before assigning anything.** One key that is not in the
  file 404s the whole request and changes nothing, rather than moving the rest and
  reporting a partial success. Capped at 500 keys per request.
- **`POST` cannot invent a `fit` or any `rank_*` value.** Those are `/scrape`'s and
  `/rank`'s conclusions, drawn from a posting one of them read. A hand-added
  entry gets `title`, `company`, an optional `url`, `first_seen`, `status`,
  `portal: "manual (user)"` and the three optional free-text fields — nothing else. It
  409s on a key already in the file, naming the entry that holds it.
- Git is the undo. `git diff data/jobs.json` shows exactly what the board
  changed; `git checkout` reverts it.

Because this lives in the Vite dev server, `bun run build` produces a static bundle with
**no write path** — the board would load nothing and save nothing. This is a local tool,
run it with `bun run dev`.

## Columns

Nine columns: `new → ranked → applied → screening → tech_interview → final_round → offer`, then the two
dead ends `rejected` and `skipped`. An entry whose status is not one of these is shown under
**New** rather than hidden — except `ghosted` and `withdrawn`, which were columns until the
collapse below and are still read as `rejected`.

The two dead ends mean different things and are worth keeping apart. `rejected` is an
application ending without an offer. `skipped` is the posting never being applied to —
whether `/scrape` or `/rank` passed it over on its own reasoning (sentence in
`excluded_reason`), you ruled it out yourself (sentence in `notes`), or the posting closed.

`dismissed` and `expired` are still written — `expired` by `/rank`, `dismissed` by older
versions of this board — and both **fold into Skipped** rather than getting a column each.
Three columns for "not applying to this" was three places to look for one answer, and the
distinction that matters is already in the sentence attached to the entry.

The first six are visible by default; the two dead ends are one click away in the Columns
menu.

## Outcomes, not columns

`ghosted` and `withdrawn` used to be their own columns. In practice that is one enormous
column and two thin ones, and still no way to say the thing that actually happened: an
employer going quiet *after* the technical interview. Three columns cannot hold one
entry.

So `rejected` absorbed both, and *how* an application ended became a multi-select
`outcome` array on the entry:

| Group | Tags |
| --- | --- |
| How it ended | `ghosted`, `withdrawn`, `on_hold` |
| How far it got | `failed_screening`, `failed_tech`, `failed_behavioural` |

They combine freely — that employer is `["ghosted", "failed_tech"]` and the card reads
`ghosted · tech`. **No tag means they simply said no.** There is deliberately no tag for
that: an explicit one could sit next to `ghosted` and say two contradictory things.

Tags are stored in the order the table lists them and deduplicated by the server, so a
card's chips never reshuffle between saves, and an emptied set deletes the key rather than
storing `[]`.

Set them from the **Outcome** submenu on right-click, the group of toggles in the detail
popover, or the **Outcome** button on the selection bar for a batch. Ticking a tag on a
card that is still live also moves it to Rejected, in the same PATCH — "they ghosted me"
and "this is over" are one decision, so the entry can never sit tagged but still open.
Dragging a card into Rejected asks the same question the stage picker and **Move to** do —
every route in goes through the dialog, so no application ends without a reading of how.
The search box matches tag names, which is how `ghosted` still finds its entries.

Card order within a column is **not** persisted — `data/jobs.json` has no ordering field,
so the per-column sort is a view setting and dropping a card sets its status, nothing
more. Columns render 25 cards at a time behind a "show more" button; `skipped` alone holds
over 150 entries. The header shows `matching / total` whenever a filter hides rows.

## Why native drag and not a drag library

The first version used dnd-kit. Every card was a `useDraggable`, each subscribed to the
drag context, so all ~90 mounted cards re-rendered on **every pointer move** of a drag.
That was unusable.

Native HTML5 drag runs the drag in the browser, not in React: between `dragstart` and
`drop` this app renders nothing, so the cost no longer scales with card count. Measured
on the real handler with 59 cards mounted: **0.005 ms per `dragover`**, 2000 events in
11 ms. `JobCard` is also wrapped in `memo`, because a column re-renders while it is
dragged over and would otherwise re-render every card inside it just to move a highlight.

Trade-off: Playwright's `dragTo` does not dispatch native HTML5 drag events, so an
end-to-end drag can't be scripted through the normal mouse API — tests have to dispatch
`DragEvent`s with a real `DataTransfer` instead.

### Why the drag felt slow even after that

Going native fixed the frame cost but introduced a worse problem: nothing on screen said
a drag had begun. Two causes, both measured rather than guessed:

1. **No dragging state at all.** The dnd-kit version dimmed the source card; the rewrite
   dropped that and never replaced it. The only remaining cue was Chromium's own
   translucent ghost, which is easy to miss.
2. **`transition-colors` easing the affordance in.** Drop zones carry a 150 ms colour
   transition for ordinary hover. Measured on the real element, the border had moved
   **3% of the way** to its target one frame after dragstart, and did not arrive until
   ~430 ms. A drag that takes a third of a second to look different reads as a drag that
   has not started.

`dragstart` itself was never the problem — it fires 26 ms after mousedown and the handler
costs ~0 ms.

So `src/lib/drag-state.ts` sets `body[data-dragging]` and `[data-dragging]` on the source
card one frame after dragstart (one frame, so the ghost snapshot catches the card at full
opacity), and the CSS for both is explicitly `transition: none`. Every drop zone becomes
receptive-looking and the source card dims within ~13 ms, with **no React render** —
which is why the flags are DOM attributes and not `useState`.

`endDrag` cancels a pending frame before clearing. Without that, a dragstart and dragend
in the same tick let the queued frame re-set the flag afterwards, leaving the whole board
stuck looking droppable.

## Privacy

This repo is private and holds real personal data. The dev server binds localhost only —
do not pass `--host`, which would expose the board, and the file it writes, on your
network.
