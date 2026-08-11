# czyjesteldorado-cli

Zero-dependency CLI for the newest IT postings on [czyjesteldorado.pl](https://czyjesteldorado.pl),
a Polish IT aggregator (Pracuj.pl, No Fluff Jobs, theprotocol.it, employers) with normalized
salary and structured descriptions. Runs on `bun` with nothing installed beyond the repo clone.

**Personal use only.** robots.txt disallows `/api/` and `/redirect/`; this CLI reads only the
allowed category and posting pages and rebuilds detail links as `/praca/<id>-<slug>`.

**Coverage is shallow by design of the portal:** only the **10 newest postings per category**
are server-rendered, and no pagination parameter works. Good daily feed, poor exhaustive search.
`meta.categories[].resultsCount` always reports the real total.

## Install

```bash
cd .agents/skills/czyjesteldorado-search/cli && bun install
```

## Usage

```bash
bun run src/cli.ts categories
bun run src/cli.ts search -c testing --format table
bun run src/cli.ts search -c testing,devops,cloud-engineering -l krakow --format table
bun run src/cli.ts search -c testing -q playwright --seniority mid
bun run src/cli.ts detail 398090-tester-automatyzujacy-itfs --format plain
bun run src/cli.ts --help
```

## Output contract

```json
{
  "meta": {
    "count": 1, "page": 1, "matched": 1, "renderedPerCategory": 10,
    "categories": [{ "category": "testing", "rendered": 10, "resultsCount": 1415 }],
    "coverage": "Only the 10 newest postings per category are server-rendered..."
  },
  "results": [
    {
      "id": "398090-tester-automatyzujacy-itfs",
      "numericId": 398090,
      "title": "Tester Automatyzujący",
      "company": "ITFS",
      "location": "Warszawa",
      "locations": ["Warszawa"],
      "date": "2026-07-29T11:43:54.000Z",
      "url": "https://czyjesteldorado.pl/praca/398090-tester-automatyzujacy-itfs",
      "salary": { "from": 110, "to": 125, "currency": "PLN", "unit": "hour", "type": "b2b", "isEstimated": false },
      "normalizedMonthlyPln": { "min": 18480, "max": 21000 },
      "seniority": "senior",
      "workModes": ["hybrid"],
      "contractTypes": ["b2b"],
      "remote": false,
      "keywords": ["API", "Playwright", "Java", "TypeScript"],
      "categories": ["testing"],
      "source": "ITFS",
      "isNew": true,
      "isFeatured": false,
      "summary": "Osoba na tym stanowisku..."
    }
  ]
}
```

`id` is `<numericId>-<slug>` and is exactly what `detail` expects.

Errors go to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`. Codes:
`BAD_ARG`, `BAD_CMD`, `NO_CATEGORY`, `BAD_CATEGORY`, `NO_ID`, `BAD_ID`, `NOT_FOUND`,
`NO_RESULTS`, `PARSE_FAILED`, `PAGE_UNSUPPORTED`, `SEARCH_FAILED`, `DETAIL_FAILED`,
`INTERNAL_ERROR`.

## Tests

```bash
bun run test        # offline parsing + CLI contract, plus four live smoke tests
bun run typecheck
```

Offline tests pin the traps that bit during development: `postedAt` being seconds not
milliseconds, analytics objects (`{"id":"gtm-..."}`) masquerading as job objects, and the
`/redirect/` URL never reaching output.

## Limitations

- 10 newest per category; `--page > 1` exits 1 with `PAGE_UNSUPPORTED`.
- No server-side keyword search (`/api/` is disallowed) — `--query` is client-side.
- `--city` is client-side on purpose: the portal's own city route returns only paid placements.

Routes that silently do nothing, parsing anchors, and diagnostics: `../url-reference.md`.
