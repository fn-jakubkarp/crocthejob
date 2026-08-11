# nofluffjobs-cli

Zero-dependency CLI for searching IT jobs on [No Fluff Jobs](https://nofluffjobs.com), the
Polish IT board where salary disclosure is mandatory. Runs on `bun` with nothing installed
beyond the repo clone.

**Personal use only.** robots.txt disallows `/api/` and all `/posting/` paths, so this CLI
reads only the allowed server-rendered listing and `/pl/job/<slug>` pages. Keep volume low.

## Install

```bash
cd .agents/skills/nofluffjobs-search/cli && bun install
```

`bun install` pulls only dev types (`typescript`, `@types/bun`) so `bun run typecheck` works.

## Usage

```bash
bun run src/cli.ts search -q qa -l cracow --format table
bun run src/cli.ts search -q "qa automation" --format table
bun run src/cli.ts search -q kubernetes --page 2 --limit 10
bun run src/cli.ts detail senior-qa-specialist-angry-nerds-remote --format plain
bun run src/cli.ts --help
```

## Output contract

```json
{
  "meta": { "count": 3, "page": 1, "renderedTotal": 20 },
  "results": [
    {
      "id": "senior-qa-specialist-angry-nerds-remote",
      "title": "Senior QA Specialist",
      "company": "Angry Nerds",
      "location": "Kraków",
      "date": null,
      "url": "https://nofluffjobs.com/pl/job/senior-qa-specialist-angry-nerds-remote",
      "salary": { "from": 11760, "to": 16800, "currency": "PLN", "unit": "month" },
      "tags": ["Testing", "QA", "Manual Testing"],
      "isNew": true
    }
  ]
}
```

`date` is `null` on every search result — the portal's cards carry no date. `detail` returns it.

Errors go to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`. Codes:
`BAD_ARG`, `BAD_CMD`, `NO_ID`, `BAD_ID`, `NOT_FOUND`, `NO_RESULTS`, `PARSE_FAILED`,
`JOBAGE_UNSUPPORTED`, `SEARCH_FAILED`, `DETAIL_FAILED`, `INTERNAL_ERROR`.

## Tests

```bash
bun run test        # offline parsing + CLI contract, plus three live smoke tests
bun run typecheck
```

`tests/parsing.test.ts` and `tests/cli-contract.test.ts` are offline and deterministic, and
include regressions for the two real bugs found while building this: the `NOWA` badge leaking
into job titles, and Angular component ids being parsed as salary figures.

## Limitations

- No date in search results; `--jobage` exits 1 with `JOBAGE_UNSUPPORTED`.
- `?page=N` is cumulative server-side, so deep pages cost more bandwidth. The CLI slices to
  give per-page semantics.
- `?criteria=` keyword search is client-side only and unusable — the keyword goes in the path.

Parsing anchors, traps, and failure diagnostics: `../url-reference.md`.
