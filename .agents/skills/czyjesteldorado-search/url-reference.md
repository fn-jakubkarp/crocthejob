# czyjesteldorado.pl - endpoint and parsing reference

Recorded 2026-07-29. Update this file when the portal changes its markup.

## What this portal is

"Czy Jest Eldorado" is an **aggregator**, not a primary job board. It republishes IT postings
collected from Pracuj.pl, No Fluff Jobs, theprotocol.it and employers directly, and normalizes
salary, seniority, work mode, contract type and city across all of them. Every job object
carries a `source` field naming where the posting came from.

Two consequences worth holding onto:

1. **Overlap is expected.** A posting found here may also come back from `nofluffjobs-search`.
   Deduplicate on company + title, and use `source` to see which upstream board it came from.
2. **The normalization is the value.** `normalizedSalaryMin/Max` converts hourly B2B rates into
   monthly PLN, which is the only way to compare an "110-125 PLN/hour" posting against a
   "15 000-18 000 PLN/month" one. No other installed portal provides this.

## Access rules (read this first)

`https://czyjesteldorado.pl/robots.txt`:

```
User-Agent: *
Allow: /
Disallow: /api/
Disallow: /redirect/
Sitemap: https://czyjesteldorado.pl/sitemap.xml
```

Allowed and used: `/praca/kategoria/<slug>` (category listings) and `/praca/<id>-<slug>`
(postings). Both are server-rendered.

**Two disallowed paths matter here:**

- `/api/` - the site's real search endpoint. This is why keyword search is unavailable.
- `/redirect/` - **each job object's own `url` field is a `/redirect/<uid>` link.** Emitting it
  would hand callers a disallowed URL, so `toCard()` always rebuilds the detail link as
  `/praca/<id>-<slug>`. There is a test asserting no `/redirect/` ever reaches output.

## Search: what works and what does not

| Attempt | Result |
|---------|--------|
| `/praca/kategoria/<slug>` | **Works.** 10 newest postings, organic (`isFeatured: false`), with `resultsCount` meta. This is the only usable search surface. |
| `/praca/kategoria/testing?q=qa` | `q` is **ignored** - identical `resultsCount` (1433) and identical first result with or without it. |
| `/?q=qa` | Returns the same 10 featured homepage postings for **any** query. Not a search. |
| `/praca/szukaj?q=qa` | No result payload. |
| `/praca` (bare) | **404** |
| `/praca/kategoria/testing/krakow` | 0 job objects - category and city do not compose as paths. |
| `/praca/miasto/<city>` | Renders 10 postings, all `isFeatured: true` - **paid placements only**, not the newest. Verified: every result on `/praca/miasto/krakow` was featured, while every result on `/praca/kategoria/devops` was not. The CLI deliberately does **not** use this route; `--city` filters the category results instead, so results stay organic. |
| `?strona=2`, `?page=2`, `?q=...&page=2` | All **ignored** - byte-identical page-1 content. |

### Category slugs (30, from the portal's own navigation)

```
admin agile ai architecture backend bi blockchain business-analytics cloud-engineering
data-engineering data-science devops embedded erp frontend fullstack game helpdesk
low-code low-level management mobile other product-management project-management
security support system-analytics testing uxui
```

`CATEGORIES` in `helpers.ts` is the authoritative copy - run `bun run src/cli.ts categories`.

Relevant to a QA-to-infrastructure search: `testing`, `devops`, `cloud-engineering`,
`support`, `helpdesk`, `security`.

### Response structure

Next.js App Router. The payload arrives as `self.__next_f.push([1,"<json-escaped>"])` chunks
that must be unescaped and joined in document order (`extractRscPayload`), because a job
object can straddle a chunk boundary.

Inside the joined payload:

```json
{"jobs":[ ...10 job objects... ],"page":1,"resultsCount":1433,"sort":"newest","filters":{"category":["testing"]}}
```

- `resultsCount` -> `meta.categories[].resultsCount`. **Always report it**: 1433 held vs. 10
  rendered is the difference between "these are the results" and "these are the newest ten".
- `sort` is `newest`, which is what makes the 10 a useful daily feed rather than an arbitrary sample.

### Job object anchor

Job objects serialize with `id` first and `uid` second, so each begins with the literal
`{"id":<digits>,"uid":"`. That anchor is deliberately narrow: the same pages carry analytics
objects like `{"id":"gtm-debug-runtime",...}` whose `id` is a **string**, and an anchor of
`{"id":` alone matches those too. There is a regression test for it.

Each candidate is brace-matched with `sliceJsonObject` (string-aware, so braces inside
description text cannot unbalance it), parsed independently, and dropped unless it has a
numeric `id`, a `slug` and a `title`.

### Field mapping

| Source field | Maps to | Notes |
|--------------|---------|-------|
| `id` + `slug` | `id` (`"398090-tester-automatyzujacy-itfs"`), `numericId`, `url` | The composite id **is** the detail path segment, so `search` output feeds `detail` directly. A bare numeric id is useless - no allowed endpoint resolves id to slug. |
| `title` | `title` | |
| `company.name` | `company` | `company.size`, `company.sectors` surface in `detail` |
| `cities` | `locations`, `location` | `location` is the first city, or `"Remote"` when `cities` is empty and `isRemote` is true |
| `postedAt` | `date` | **Unix timestamp in seconds.** Read as milliseconds it lands in 1970; there is a test pinning the year. |
| `salary[]` | `salary` | `{contractType, period, currency, min, max, isEstimated}`. The entry with `isEstimated: false` is preferred - a published figure beats the portal's guess. |
| `normalizedSalaryMin/Max` | `normalizedMonthlyPln` | Monthly PLN. Rank on this. |
| `seniority`, `workModes`, `contractTypes`, `workloadTypes`, `keywords`, `categories`, `isRemote`, `isNew`, `isFeatured`, `source` | same names | |
| `description` | `summary` (search), `description` + `descriptionSections` (detail) | **A structured object**, not a string - see below |
| `url` | **discarded** | `/redirect/<uid>`, robots-disallowed |

### `description` is an object, not a string

```json
{"about":"","summary":"Osoba na tym stanowisku...","responsibilities":"- Automatyzacja testów...",
 "requirements":"- Min. 4 lata doświadczenia\n- Znajomość **Playwright**...","benefits":"...","other":""}
```

Six keys observed: `about`, `summary`, `responsibilities`, `requirements`, `benefits`, `other`.
Content is markdown-ish (`**bold**`, `- bullets`) with real newlines - better than the HTML
soup other portals return. Empty strings are common and are dropped rather than emitted as
empty headings.

`sectionsToText` renders `summary` first without a heading (it reads as the lede), then the
remaining sections in reading order with upper-case labels, then **any unrecognized key**, so a
new section the portal adds later still appears instead of being silently discarded.

Note the listing payload already carries the full description object, which is why `search`
can populate `summary` with no extra request.

## Detail

```
GET https://czyjesteldorado.pl/praca/<numericId>-<slug>
```

Same RSC payload and same job-object shape. A detail page **also renders "similar offers"**, so
`parseJobDetail` matches on the requested id rather than taking the first job object it finds.

## Pagination

**Not available.** No parameter has any effect, and deeper results come from the disallowed
`/api/`. The CLI exits 1 with `PAGE_UNSUPPORTED` for `--page > 1` rather than re-serving the
same 10 postings as if they were page two.

To widen coverage, pass more categories (`-c testing,devops,cloud-engineering`) - one HTTP
request each, deduplicated by id - or run again later, since the feed is sorted newest-first.

## Client-side filters

`--query`, `--city`, `--seniority`, `--remote` and `--jobage` are all applied **after** parsing,
because the allowed paths expose no equivalent parameters. They therefore narrow the 10 newest
per category, not the whole board. `--query` matches title, company, summary, keywords and
categories with all terms required, diacritic- and case-insensitively (`foldCase`), so
`"tester automatyzujacy"` matches `"Tester Automatyzujący"`.

Both the `table` coverage line (on stderr) and `meta.coverage` (in JSON) state this explicitly.

## If parsing breaks

- **`PARSE_FAILED`** - `self.__next_f` chunking changed. Check `extractRscPayload`.
- **Zero jobs but the page loads in a browser** - the key order changed and `{"id":<digits>,"uid":"`
  no longer matches. Dump the payload and find the new leading keys.
- **Analytics objects appearing as jobs** - the numeric-id constraint in the anchor was relaxed.
- **Dates in 1970** - something started treating `postedAt` as milliseconds.
- **Salaries that look like hourly rates in a monthly column** - `normalizedSalaryMin/Max` was
  renamed; the live test asserting monthly figures exceed 1000 PLN should catch this.
