# Studio

The web apps and the code they share. Everything here is about job searching in
general and nothing here is about one job seeker in particular: no profile, no CV,
no application history. That is the rule this directory is organised around, so it
can be published on its own without anything having to be scrubbed out of it first.

```
studio/
├── apps/
│   └── web/             one app: kanban board now, CV maker alongside it later
└── packages/
    └── jobs-data/       what a job entry is, and the only code that opens the file
```

## Running it

```bash
bun install
bun run dev        # http://localhost:5173
```

`bun run ci` typechecks and lints every workspace.

## Where the data comes from

The board reads and writes one JSON file. It is not in this directory, and it does
not have to be anywhere in particular. `packages/jobs-data/store.ts` looks in three
places, first hit wins:

1. **`JOBS_FILE`** in the environment, resolved as a path. Always wins.
2. **`../data/jobs.json`**, next to `studio/`, if it exists. This is the private
   repo this directory sits inside, where the board is one consumer of a file that
   the scrape and rank workflows also write.
3. **`studio/data/jobs.json`**, created on first write. The standalone default.

```bash
JOBS_FILE=~/jobs.json bun run dev
```

A missing file reads as empty rather than an error, so a fresh checkout opens on an
empty board and fills as postings are added.

## The shape of an entry

`packages/jobs-data/schema.ts` is the whole definition. In short: entries are keyed
by posting URL (or a `manual:` key for one added by hand), `status` moves through
`new → ranked → applied → screening → tech_interview → final_round → offer` plus the dead ends
`rejected` and `skipped`, and `outcome` is a combinable array saying *how* a
rejection ended rather than a status of its own.

Two halves, so a browser bundle never pulls in `node:fs`:

- `@jobsearch/jobs-data` — schema, duplicate detection, field readers. Isomorphic.
- `@jobsearch/jobs-data/server` — the file, the write queue, validation. Node only.
