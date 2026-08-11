---
name: justjoinit-search
version: 1.0.0
description: >
  Use this skill to search IT and tech job listings on justjoin.it, Poland's largest IT
  job board, or to look up the full description of a specific justjoin.it offer. Covers
  Kraków, Warszawa, Wrocław, Poznań, Gdańsk, Łódź, Katowice and fully remote roles across
  QA, testing, DevOps, SRE, cloud, backend, frontend, mobile, data and security. Results
  include published salary ranges in PLN. Trigger phrases: justjoin, justjoin.it, just
  join it, Polish IT jobs, jobs in Kraków, jobs in Warsaw, praca IT, oferty pracy IT,
  szukam pracy, praca zdalna, praca w Krakowie, QA jobs Poland, DevOps jobs Poland.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/justjoinit-search/cli/src/cli.ts *)
---

# justjoin.it Search Skill

Search live IT job listings from **justjoin.it** (Poland's largest IT job board). No
authentication, no API key, and **zero runtime dependencies** — it runs with just `bun`.

Unusually for a job board, justjoin.it publishes salary ranges on most offers, so search
results carry real numbers rather than "competitive salary".

## ⚠️ Personal use only

justjoin.it's `robots.txt` disallows `/api/`, and `api.justjoin.it` disallows everything.
**This CLI never touches the JSON API** — it reads only the public HTML pages, which are
allowed, and parses the offer data those pages already embed. Automated access may still
conflict with the portal's terms of service, so **keep volume low, don't use it commercially
or for bulk data collection**, and run it on your own responsibility. One search is one
HTTP request.

## When to use this skill

- Search Polish IT job openings by keyword, city, category, or seniority
- Find fully remote Polish/EU roles (`--location remote`)
- Filter to recent postings (`--jobage 7`)
- Get an offer's full description, required skills, language requirements, and apply link

## Commands

### Search job listings

```bash
bun run .agents/skills/justjoinit-search/cli/src/cli.ts search [flags]
```

Flags:
- `--query <text>` / `-q <text>` — keyword search over title and skills. **Server-side.**
- `--location <city>` / `-l <city>` — city, `remote`, or `all-locations` (default). Accepts English and Polish spellings: `Cracow`, `Krakow`, `Kraków`, `Warsaw`, `Warszawa`, `Wrocław`, `zdalnie`.
- `--category <slug>` / `-c <slug>` — category path segment: `testing`, `devops`, `data`, `frontend`, `backend`, `mobile`, `security`, `ai`.
- `--jobage <days>` — keep offers published within N days (client-side).
- `--experience <level>` — `junior`, `mid`, `senior`, `c_level` (client-side).
- `--remote <mode>` — `remote`, `hybrid`, `office` (client-side, matches `workplaceType`).
- `--limit <n>` / `-n <n>` — cap results emitted.
- `--format json|table|plain` — default `json`.
- `--page <n>` — **only `1` works.** See Notes; `--page 2` exits 1 rather than silently repeating page 1.

### Fetch full offer detail

```bash
bun run .agents/skills/justjoinit-search/cli/src/cli.ts detail <slug|url> [--format json|plain]
```

`slug` is the `id` from search results, e.g. `singu-qa-engineer-krakow-testing`. A full
`https://justjoin.it/job-offer/...` URL also works. Returns the description, salary in the
employer's own currency, required and nice-to-have skills, language requirements, company
size, hybrid office days, validity dates, and the apply link (often a direct link to the
employer's ATS rather than the portal).

## Usage examples

```bash
# QA roles open in Kraków, most recent first
bun run .agents/skills/justjoinit-search/cli/src/cli.ts search -q "QA" -l cracow --format table

# Everything in the testing category, remote only, posted in the last week
bun run .agents/skills/justjoinit-search/cli/src/cli.ts search -c testing -l remote --jobage 7 --format table

# Mid-level Playwright roles anywhere in Poland
bun run .agents/skills/justjoinit-search/cli/src/cli.ts search -q "playwright" --experience mid --limit 10 --format table

# Junior DevOps in Kraków
bun run .agents/skills/justjoinit-search/cli/src/cli.ts search -c devops -l krakow --experience junior --format table

# Full detail for one offer
bun run .agents/skills/justjoinit-search/cli/src/cli.ts detail singu-qa-engineer-krakow-testing --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing `id` values to `detail` |
| `table` | Quick scanning: title, company, location, level, salary, date |
| `plain` | Reading a single offer's full detail |

Search JSON is `{ "meta": { "count", "page", "totalMatching" }, "results": [...] }`. Each
result carries `id`, `title`, `company`, `location`, `locations`, `date`, `url`, `salary`,
`experienceLevel`, `workplaceType`, `remote`, and `skills`; missing values are `null`, never
omitted.

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process
exits with code `1`.

## Notes

- **Salary is real.** `salary` reports the employer's own currency and contract type
  (`b2b` / `permanent`), taken from the entry justjoin.it flags as original. The other
  currencies in the source data are conversions and are discarded.
- **`locations` explains surprising cities.** A search for Kraków can return an offer whose
  `location` is Gdańsk, because the offer is *also* open in Kraków. `locations` lists every
  city, so the match is verifiable rather than looking like a bug.
- **No pagination.** A listing page server-renders only its first ~100 offers; deeper pages
  are loaded client-side from the disallowed `/api/`. `--page > 1` therefore fails with
  `PAGE_UNSUPPORTED` instead of quietly repeating page 1. Narrow the query instead — with
  `--category` and `--location` the ~100 ceiling is rarely the binding constraint.
- **Description formatting is imperfect, by the portal's design.** justjoin.it strips block
  markup before the description reaches any allowed source, so paragraph breaks are fused
  ("...operations.Our mission..."). The CLI re-inserts breaks only after sentence-ending
  punctuation followed by a capital; it never alters wording. Boundaries without punctuation
  stay fused.
- `--jobage`, `--experience` and `--remote` are client-side filters, applied after fetching,
  because the allowed HTML paths expose no equivalent parameters. They therefore filter
  within the ~100 offers the page returned.
- justjoin.it may rate-limit; the CLI retries 429/5xx with exponential backoff and jitter
  (max 6 attempts). Keep volume low — see the personal-use note above.
- Parsing anchors and failure modes are documented in `url-reference.md`. Start there if the
  CLI suddenly returns zero results.
