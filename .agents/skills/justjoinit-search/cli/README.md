# justjoinit-cli

Zero-dependency CLI for searching IT jobs on [justjoin.it](https://justjoin.it), Poland's
largest IT job board. Runs on `bun` with nothing installed beyond the repo clone.

**Personal use only.** justjoin.it's robots.txt disallows `/api/`, so this CLI reads only the
public HTML pages and parses the offer data they already embed. Keep volume low; one search is
one HTTP request.

## Install

```bash
cd .agents/skills/justjoinit-search/cli && bun install
```

`bun install` only pulls dev types (`typescript`, `@types/bun`) so `bun run typecheck` works.
The CLI itself needs no dependencies.

## Usage

```bash
bun run src/cli.ts search -q "QA" -l cracow --format table
bun run src/cli.ts search -c testing -l remote --jobage 7 --format table
bun run src/cli.ts search -q playwright --experience mid --limit 10
bun run src/cli.ts detail singu-qa-engineer-krakow-testing --format plain
bun run src/cli.ts --help
```

## Output contract

```json
{
  "meta": { "count": 6, "page": 1, "totalMatching": 239 },
  "results": [
    {
      "id": "singu-qa-engineer-krakow-testing",
      "title": "QA Engineer",
      "company": "SINGU",
      "location": "Kraków",
      "locations": ["Kraków"],
      "date": "2026-07-25T13:00:17.1805767Z",
      "url": "https://justjoin.it/job-offer/singu-qa-engineer-krakow-testing",
      "salary": { "type": "b2b", "from": 15000, "to": 17000, "currency": "PLN", "unit": "month", "gross": null },
      "experienceLevel": "mid",
      "workplaceType": "hybrid",
      "remote": false,
      "skills": ["Playwright", "CI/CD", "API Testing"]
    }
  ]
}
```

Errors go to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`. Codes:
`BAD_ARG`, `BAD_CMD`, `NO_ID`, `BAD_ID`, `NOT_FOUND`, `PARSE_FAILED`, `PAGE_UNSUPPORTED`,
`SEARCH_FAILED`, `DETAIL_FAILED`, `INTERNAL_ERROR`.

## Tests

```bash
bun run test        # offline parsing + CLI contract, plus two live smoke tests
bun run typecheck
```

`tests/parsing.test.ts` and `tests/cli-contract.test.ts` are offline and deterministic.
`tests/search.test.ts` hits the live portal (needs network) and asserts that a real search
returns populated fields and that `detail` yields a readable description.

## Limitations

- **No pagination.** ~100 offers per query are server-rendered; `--page > 1` exits 1 with
  `PAGE_UNSUPPORTED` rather than silently repeating page 1.
- `--jobage`, `--experience`, `--remote` are client-side filters over those ~100 offers.
- Description paragraph breaks are partly unrecoverable — the portal strips block markup
  before publishing it. See `../url-reference.md`.

Parsing anchors, response shapes, and failure diagnostics: `../url-reference.md`.
