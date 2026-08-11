# justjoin.it - endpoint and parsing reference

Recorded 2026-07-29. This is the file to update when the portal changes its markup.

## Access rules (read this first)

`https://justjoin.it/robots.txt`:

```
Disallow: /api/
```

`https://api.justjoin.it/robots.txt`:

```
User-agent: *
Allow: /sitemap
Allow: /pricing
Allow: /login
Allow: /register
Disallow: /
```

**The JSON API is disallowed on both hosts, so this CLI never calls it.** Everything is read
from the public HTML listing and detail pages, which are allowed. If you extend this skill,
do not "fix" a limitation by reaching for `api.justjoin.it` - the limitations documented
below are the price of staying inside robots.txt.

Automated access may still conflict with the portal's terms of service, so the skill carries
a personal-use-only warning and the CLI keeps its request count to one page per search.

## Search

```
GET https://justjoin.it/job-offers/<location>[/<category>][?keyword=<text>]
```

| Parameter | Where | Notes |
|-----------|-------|-------|
| location | 1st path segment | `all-locations` (default), a city slug (`krakow`, `warszawa`, `wroclaw`, `poznan`, `gdansk`, `lodz`, `katowice`), or `remote`. `locationSlug()` maps English and Polish spellings, strips diacritics, and converts `ł` to `l`. |
| category | 2nd path segment | Optional. e.g. `testing`, `devops`, `data`, `frontend`, `backend`, `mobile`, `security`, `ai`. |
| keyword | query string | Server-side keyword match over title/skills. Verified filtering: `?keyword=qa` returned 610 matches vs. the unfiltered set. |
| page | **not supported** | The page ignores it. See "Pagination" below. |

### Response structure

The page is a Next.js App Router document. There is no `__NEXT_DATA__`; the payload arrives as
a stream of calls:

```html
<script>self.__next_f.push([1,"<json-escaped chunk>"])</script>
```

A single offer object routinely straddles a chunk boundary, so **all chunks must be
JSON-unescaped and concatenated in document order before parsing** (`extractRscPayload`).
A search page emits roughly 78-80 chunks totalling ~620 KB of payload.

Inside the joined payload, the offer list sits under:

```json
{"meta":{"from":0,"totalItems":705,"next":{"cursor":100,"itemsCount":100}},"data":[ ...offers... ]}
```

- `meta.totalItems` -> `meta.totalMatching` in the CLI's JSON output.
- Each offer object is serialized with **alphabetically ordered keys**, so it always begins
  with the literal `{"applyUrl":`. That is the parsing anchor (`parseOffers`). Each candidate
  is brace-matched with `sliceJsonObject` (which tracks string state, so braces inside
  description text cannot unbalance it), parsed on its own, and validated for
  `slug` + `title` + `companyName` before being accepted. An unrelated object carrying an
  `applyUrl` key is discarded rather than corrupting the result set.

### Offer fields (listing)

| Field | Maps to | Notes |
|-------|---------|-------|
| `slug` | `id`, `url` | Detail URL is `https://justjoin.it/job-offer/<slug>` |
| `title` | `title` | |
| `companyName` | `company` | |
| `city` | `location` | The **primary** city only |
| `multilocation[].city` | `locations` | Every city the offer is open in. A `-l krakow` search legitimately returns offers whose primary city is Gdańsk or Łódź because they are also open in Kraków - this field is what explains that, and it is why the CLI exposes it. |
| `publishedAt` | `date` | ISO 8601 |
| `employmentTypes[]` | `salary` | One entry per currency. **Only the entry with `currencySource: "original"` is the employer's real figure**; the rest are conversions. |
| `experienceLevel` | `experienceLevel` | `junior` \| `mid` \| `senior` \| `c_level`. Flat string on a listing card. |
| `workplaceType` | `workplaceType`, `remote` | `remote` \| `hybrid` \| `office`. Flat string on a listing card. |
| `requiredSkills` | `skills` | Strings on a listing card, objects (`{id,name,level}`) on a detail page - `namesOf()` handles both. |

## Detail

```
GET https://justjoin.it/job-offer/<slug>
```

Two sources are combined:

1. **`ld+json` schema.org `JobPosting`** (`parseLdJobPosting`) - the trustworthy source for
   `description`, `datePosted`, `validThrough`, `employmentType`, and `baseSalary`.
   **`baseSalary` is the correct salary on a detail page**: the page's own `employmentTypes`
   array leads with a *converted* currency (GBP was observed first) and omits
   `currencySource` entirely, so picking its first entry would report the wrong number.
2. **The detail page's RSC offer object** (`parseDetailOffer`) - for fields ld+json omits:
   `requiredSkills`, `niceToHaveSkills`, `languages`, `companySize`, `companyUrl`, `street`,
   `hybridWorkSchedule.officeDays`, `expiredAt`, and `applyUrl` (often a direct link to the
   employer's ATS, which is more useful than the portal page).

A detail page serializes the offer **differently from a listing card**: it opens with
`{"slug":"<slug>","title":` and nests values that are flat on a card - `experienceLevel` and
`workplaceType` become `{label,value}` objects. `labelOf()` reads both shapes. The anchor also
matches `multilocation[]` stubs, which start with the same slug+city pair, so
`parseDetailOffer` keeps scanning until it finds an object that actually has `companyName`.

### Known limitation: description formatting

justjoin.it strips block markup out of the description **before** it reaches ld+json - the
field contains no tags at all, so paragraph boundaries arrive fused
("...run their operations.Our mission is..."). The RSC payload does not help: the offer's
`body` field is an unresolved RSC reference (`"$57"`) that is not present in the initial
document. The original structure is not recoverable from an allowed source.

`reflowRunOnText` therefore re-inserts a line break only where sentence-ending punctuation is
immediately followed by a capital letter (Polish capitals included). It never changes, drops,
or reorders words, and it is skipped entirely when the text already contains line breaks.
Boundaries with no punctuation ("B2BLocation: Gdańsk") stay fused - that is accepted rather
than guessed at.

## Pagination

**Not available.** A listing page server-renders only its first batch of ~100 offers, and
`meta.next.cursor` is consumed client-side against the disallowed `/api/` endpoints. Adding
`?page=2` returns byte-identical page-1 results.

The CLI therefore **exits 1 with `PAGE_UNSUPPORTED` for `--page > 1`** instead of silently
re-serving page 1, which a caller paging through results would mistake for new offers. To
reach more of the corpus, narrow the query (`--query`, `--category`, `--location`,
`--experience`) rather than paging.

## Client-side filters

`--jobage`, `--experience`, and `--remote` are all applied **after** parsing, because the
allowed HTML paths expose no equivalent parameters. `--jobage` compares against `publishedAt`
and keeps offers whose date is missing or unparsable rather than dropping them silently.

## If parsing breaks

Symptoms and where to look:

- **`PARSE_FAILED` on search** - `self.__next_f` chunking changed, or the framework moved to a
  different payload transport. Check `extractRscPayload`.
- **Zero results but the page loads in a browser** - the offer key order changed, so the
  `{"applyUrl":` anchor no longer matches. Dump the payload and find the new first key.
- **Salary suddenly in USD/EUR/GBP** - the `currencySource: "original"` marker changed name.
- **Empty `description`** - the ld+json `JobPosting` block moved or was removed; check whether
  the RSC `body` reference is now resolvable in the initial payload.
