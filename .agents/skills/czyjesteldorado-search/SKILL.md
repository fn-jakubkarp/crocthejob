---
name: czyjesteldorado-search
version: 1.0.0
description: >
  Use this skill to see the newest IT job postings on czyjesteldorado.pl, a Polish IT job
  aggregator that republishes offers from Pracuj.pl, No Fluff Jobs, theprotocol.it and
  employers with normalized salary, seniority, work mode and contract type, or to look up
  one posting's full structured description. Best used as a daily "what is new" feed per
  category (testing, devops, cloud-engineering, support, helpdesk, security, backend,
  frontend and 22 more) rather than as an exhaustive search. Trigger phrases: czy jest
  eldorado, czyjesteldorado, eldorado jobs, newest Polish IT jobs, new IT postings today,
  najnowsze oferty pracy IT, nowe oferty IT, praca IT Kraków, agregator ofert IT,
  znormalizowane widełki, QA jobs Poland, DevOps jobs Poland.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/czyjesteldorado-search/cli/src/cli.ts *)
---

# czyjesteldorado.pl Search Skill

Read the newest IT postings from **czyjesteldorado.pl**, a Polish IT **aggregator**. No
authentication, no API key, and **zero runtime dependencies** — it runs with just `bun`.

Two things make it worth having alongside the other Polish portals:

1. **Normalized salary.** The portal converts hourly B2B rates into monthly PLN
   (`normalizedMonthlyPln`), which is the only way to compare `110-125 PLN/hour` against
   `15 000-18 000 PLN/month`. No other installed portal does this.
2. **Structured descriptions.** Postings arrive already split into `summary`,
   `responsibilities`, `requirements` and `benefits` — no HTML flattening guesswork.

## ⚠️ Read this before relying on it: coverage is shallow

Only the **10 newest postings per category** are reachable. The portal's real search posts to
`/api/`, which its `robots.txt` disallows, and no pagination parameter has any effect. A
category holding 1 400+ postings still renders only its newest 10.

So this skill is:
- **Good** as a daily/frequent "what appeared since last run" feed, especially across several
  categories at once. `/scrape` deduplicates across runs, so running it often is how coverage
  accumulates.
- **Poor** for exhaustive search. Use `justjoinit-search` (~100 per query) or
  `nofluffjobs-search` (paginated) when you need breadth.

`meta.categories[].resultsCount` always reports how many postings the portal actually holds, so
the gap between "shown" and "exists" is never hidden. `--page > 1` exits 1 rather than
re-serving the same ten as page two.

## ⚠️ Personal use only

`robots.txt` disallows `/api/` and `/redirect/`. **This CLI never calls either** — and note
that each posting's own `url` field *is* a `/redirect/` link, so detail URLs are always rebuilt
in the allowed `/praca/<id>-<slug>` form. Automated access may still conflict with the portal's
terms, so **keep volume low, don't use it commercially or for bulk collection**, and run it on
your own responsibility. One category is one HTTP request.

## Commands

### List categories

```bash
bun run .agents/skills/czyjesteldorado-search/cli/src/cli.ts categories
```

### Search (newest per category)

```bash
bun run .agents/skills/czyjesteldorado-search/cli/src/cli.ts search --category <slug[,slug...]> [flags]
```

- `--category <slugs>` / `-c` — **required**, comma-separated. One HTTP request per category, results merged and deduplicated. There is no keyword-only search; see Notes.
- `--query <text>` / `-q` — **client-side** filter over title, company, summary, keywords and categories. All terms must match; diacritic- and case-insensitive, so `"tester automatyzujacy"` matches `"Tester Automatyzujący"`.
- `--city <city>` / `-l` — client-side city filter, or `remote`. Accepts Polish spellings.
- `--seniority <level>` — `junior`, `mid`, `senior` (client-side).
- `--remote` — fully remote postings only.
- `--jobage <days>` — postings published within N days.
- `--limit <n>` / `-n` — cap results emitted.
- `--format json|table|plain` — default `json`.

### Fetch full posting detail

```bash
bun run .agents/skills/czyjesteldorado-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the `id` from search results, e.g. `398090-tester-automatyzujacy-itfs` — the numeric id
**and** slug together, because that is the detail path. A bare numeric id is rejected with a
clear error: no allowed endpoint resolves an id to its slug.

## Usage examples

```bash
# What is new in testing right now
bun run .agents/skills/czyjesteldorado-search/cli/src/cli.ts search -c testing --format table

# The QA-to-infrastructure bridge categories, Kraków only
bun run .agents/skills/czyjesteldorado-search/cli/src/cli.ts search -c testing,devops,cloud-engineering -l krakow --format table

# Mid-level Playwright work
bun run .agents/skills/czyjesteldorado-search/cli/src/cli.ts search -c testing -q playwright --seniority mid --format table

# Remote support and infra roles from the last 3 days
bun run .agents/skills/czyjesteldorado-search/cli/src/cli.ts search -c devops,support,helpdesk --remote --jobage 3 --format table

# Full structured description
bun run .agents/skills/czyjesteldorado-search/cli/src/cli.ts detail 398090-tester-automatyzujacy-itfs --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing `id` values to `detail` |
| `table` | Quick scanning: title, company, location, level, normalized salary, source, date |
| `plain` | Reading one posting's full detail |

Search JSON is `{ "meta": { "count", "page", "matched", "renderedPerCategory", "categories", "coverage" }, "results": [...] }`.
Each result carries `id`, `numericId`, `title`, `company`, `location`, `locations`, `date`,
`url`, `salary`, `normalizedMonthlyPln`, `seniority`, `workModes`, `contractTypes`, `remote`,
`keywords`, `categories`, `source`, `isNew`, `isFeatured`, and `summary`; missing values are
`null`, never omitted. In `table` format the coverage line is printed to **stderr** so it can
never be mistaken for a result row.

All errors go to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Notes

- **It is an aggregator, so expect overlap.** `source` names the upstream board (`theprotocol.it`,
  `No Fluff Jobs`, or the employer). When cross-referencing with `nofluffjobs-search`,
  deduplicate on company + title and keep whichever record has the better description.
- **`normalizedMonthlyPln` is the field to rank and filter on.** `salary` preserves what the
  source actually said (including `unit: "hour"` and `isEstimated`), while the normalized
  figure is comparable across contract types. A figure the portal estimated rather than read
  from the posting is flagged with `isEstimated: true` and shown with a `~` prefix in tables.
- **No keyword search server-side.** `--query` filters the fetched categories. Passing more
  categories widens the pool before the filter runs; that is the lever that matters.
- **City filtering is client-side on purpose.** The portal's `/praca/miasto/<city>` route
  returns *only paid placements* (every result comes back `isFeatured: true`), whereas category
  pages return organic newest-first results. Filtering category results keeps the output
  organic rather than trading it for an ad feed.
- **`--jobage` works here**, unlike on `nofluffjobs-search`, because every posting carries a
  real timestamp.
- The portal may rate-limit; the CLI retries 429/5xx with exponential backoff and jitter
  (max 6 attempts).
- Parsing anchors, the routes that silently do nothing, and failure diagnostics are all in
  `url-reference.md`. Read it before debugging.
