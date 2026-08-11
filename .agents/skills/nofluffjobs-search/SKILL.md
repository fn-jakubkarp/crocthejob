---
name: nofluffjobs-search
version: 1.0.0
description: >
  Use this skill to search IT and tech job listings on No Fluff Jobs (nofluffjobs.com), the
  Polish IT job board where every posting must publish a salary range, or to look up the
  full description of a specific posting. Covers Kraków, Warszawa, Wrocław, Poznań, Gdańsk,
  Łódź, Katowice and remote roles across QA, testing, DevOps, SRE, cloud, backend, frontend,
  mobile, data and security, with B2B and employment contract rates. Trigger phrases: no
  fluff jobs, nofluffjobs, nfj, Polish IT jobs with salary, jobs in Kraków, jobs in Warsaw,
  praca IT, oferty pracy IT z widełkami, widełki płacowe, praca zdalna, B2B stawki, QA jobs
  Poland, DevOps jobs Poland.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/nofluffjobs-search/cli/src/cli.ts *)
---

# No Fluff Jobs Search Skill

Search live IT job listings from **No Fluff Jobs**. No authentication, no API key, and
**zero runtime dependencies** — it runs with just `bun`.

The portal's defining feature is that **salary disclosure is mandatory**, so search results
carry real ranges and contract types rather than "competitive salary". That makes this the
best installed portal for filtering on compensation before spending any effort on an
application.

## ⚠️ Personal use only

nofluffjobs.com's `robots.txt` disallows `/api/` and every `/posting/` path. **This CLI never
calls either** — it reads only the allowed server-rendered listing pages and `/pl/job/<slug>`
detail pages. Automated access may still conflict with the portal's terms of service, so
**keep volume low, don't use it commercially or for bulk data collection**, and run it on
your own responsibility. One search is one HTTP request.

## When to use this skill

- Search Polish IT job openings by keyword and city, **with salary ranges attached**
- Compare advertised rates across similar roles before applying
- Find remote roles (`--location remote`)
- Get a posting's full description, posting date, and contract type

## Commands

### Search job listings

```bash
bun run .agents/skills/nofluffjobs-search/cli/src/cli.ts search [flags]
```

Flags:
- `--query <text>` / `-q <text>` — keyword (role or technology). Becomes a **path segment**, which is how this portal filters server-side. Arbitrary keywords work: `qa`, `devops`, `playwright`, `kubernetes`, `"qa automation"`.
- `--location <city>` / `-l <city>` — city or `remote`. Accepts `Cracow`, `Krakow`, `Kraków`, `Warsaw`, `Warszawa`, `Wrocław`, `zdalnie`.
- `--page <n>` — 1-indexed, 20 results per page.
- `--limit <n>` / `-n <n>` — cap results emitted.
- `--format json|table|plain` — default `json`.
- `--jobage <days>` — **not supported**, exits 1. Listing cards carry no date; see Notes.

### Fetch full posting detail

```bash
bun run .agents/skills/nofluffjobs-search/cli/src/cli.ts detail <slug|url> [--format json|plain]
```

`slug` is the `id` from search results, e.g. `senior-qa-specialist-angry-nerds-remote`. A
full `https://nofluffjobs.com/pl/job/...` URL or a `/pl/job/...` path also works. Returns
the description, **posting date** (absent from search results), employment type, structured
salary, and location.

## Usage examples

```bash
# QA roles in Kraków, with salary ranges
bun run .agents/skills/nofluffjobs-search/cli/src/cli.ts search -q qa -l cracow --format table

# QA automation anywhere in Poland
bun run .agents/skills/nofluffjobs-search/cli/src/cli.ts search -q "qa automation" --format table

# Remote DevOps
bun run .agents/skills/nofluffjobs-search/cli/src/cli.ts search -q devops -l remote --limit 10 --format table

# Search by technology rather than job title
bun run .agents/skills/nofluffjobs-search/cli/src/cli.ts search -q kubernetes --format table

# Second page of results
bun run .agents/skills/nofluffjobs-search/cli/src/cli.ts search -q qa --page 2 --format table

# Full detail, including the posting date
bun run .agents/skills/nofluffjobs-search/cli/src/cli.ts detail senior-qa-specialist-angry-nerds-remote --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing `id` values to `detail` |
| `table` | Quick scanning: title, company, location, salary, tags |
| `plain` | Reading a single posting's full detail |

Search JSON is `{ "meta": { "count", "page", "renderedTotal" }, "results": [...] }`. Each
result carries `id`, `title`, `company`, `location`, `date`, `url`, `salary`, `tags`, and
`isNew`; missing values are `null`, never omitted.

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process
exits with code `1`.

## Notes

- **`date` is always `null` in search results.** The portal's listing cards render no date at
  all. `detail` supplies it from the posting's structured data. This is why `--jobage` exits
  with `JOBAGE_UNSUPPORTED` rather than silently ignoring the flag — reach for
  `justjoinit-search` when recency filtering is the priority.
- **`isNew` is the recency signal available at search time.** It reflects the portal's own
  "NOWA" badge, which marks recently added postings.
- **Salary is the reason to use this portal.** `salary` gives `from`, `to`, `currency`, and
  `unit` (`month` or `hour`). A posting that genuinely publishes no figure yields `null`
  rather than a guessed number.
- **`location` can read `Kraków +3` or `Zdalnie`.** That is the portal's own rendering for
  multi-city and remote offers, preserved verbatim rather than normalized into something the
  source does not say.
- **Pagination is cumulative under the hood.** `?page=N` server-renders pages 1..N; the CLI
  slices so `--page` behaves like a page. Consequence: requesting page 5 downloads pages 1-5,
  so deep paging costs proportionally more. `meta.renderedTotal` shows what the page contained.
- **Keyword search must be a path segment.** `?criteria=` is client-side only and returns a
  page with zero cards to any plain fetch — a trap worth knowing if you extend this skill.
- An empty result set is reported as `NO_RESULTS` on stderr with exit 1, not as an empty
  success, because a zero parse is indistinguishable from broken selectors.
- The portal may rate-limit; the CLI retries 429/5xx with exponential backoff and jitter
  (max 6 attempts).
- Parsing anchors, traps, and failure diagnostics are in `url-reference.md`.
