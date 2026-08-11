# No Fluff Jobs (nofluffjobs.com) - endpoint and parsing reference

Recorded 2026-07-29. Update this file when the portal changes its markup.

## Access rules (read this first)

`https://nofluffjobs.com/robots.txt`:

```
User-agent: *
Allow: /
Disallow: /pdf/
Disallow: /not-found*
Disallow: */job/job/*
Disallow: /api/
Disallow: /posting/
Disallow: /pl/posting/      (and /hu/, /ua/, /cz/, /sk/, /nl/, /ua-ru/)
Disallow: /signal
```

Allowed and used by this CLI:
- `/pl/<keyword>[/<city>]` - listing pages (server-rendered)
- `/pl/job/<slug>` - detail pages (server-rendered)

Disallowed and therefore never called: `/api/` (the JSON search endpoint) and every
`/posting/` path. Automated access may still conflict with the portal's terms, so the
generated skill carries a personal-use-only warning.

## Search

```
GET https://nofluffjobs.com/pl/<keyword>[/<city>][?page=<n>]
```

| Parameter | Where | Notes |
|-----------|-------|-------|
| keyword | 1st path segment | URL-encoded. Arbitrary keywords work, not just category slugs - `qa`, `devops`, `playwright`, `kubernetes`, `qa%20automation` were all verified to filter correctly server-side. |
| city | 2nd path segment | `krakow`, `warszawa`, `wroclaw`, `poznan`, `gdansk`, `lodz`, `katowice`, or `praca-zdalna` for remote. `citySlug()` maps English and Polish spellings. |
| page | query string | Cumulative - see Pagination. |

**`?criteria=<text>` does not work for automated access.** It is applied client-side only:
`GET /pl?criteria=qa` returns a page with **zero** job cards in its HTML. The keyword must be
a path segment. This was the first thing that looked right and was wrong.

**A city cannot stand alone as the only segment** - it would be read as the keyword. When
`--location` is given without `--query`, the CLI inserts the portal's catch-all keyword
segment (`praca-it`) first, producing `/pl/praca-it/krakow`.

### Response structure

Angular SSR: the listing HTML is fully server-rendered, no JSON payload to extract. Each card
is an `<a nfj-postings-item ... href="/pl/job/<slug>">` element. `parseJobCards` splits the
document on `nfj-postings-item` so every card is parsed from its own chunk and one malformed
card cannot break the rest.

Fields are anchored on **`data-cy` attributes** - the portal's own e2e test hooks. These are
far more durable than the Tailwind classes beside them, which change with any restyle.

| Field | Anchor | Notes |
|-------|--------|-------|
| `id` | `href="/pl/job/<slug>"` | Also present as `id="nfjPostingListItem-<slug>"` |
| `title` | `data-cy="title position on the job offer listing"` (inside `<h3>`) | **Strip the badge first** - see below |
| `company` | `<h4 class="company-name">` | Contains a leading `<inline-icon>` svg; tags must be stripped |
| `location` | `<nfj-posting-item-city data-cy="location on the job offer listing">` | Multi-city offers render as `Kraków +3`. Remote renders as `Zdalnie`. |
| `salary` | `data-cy="salary ranges on the job offer listing"` | Printed text, e.g. `11&nbsp;760 – 16&nbsp;800  PLN` |
| `tags` | `data-cy="category name on the job offer listing"` (repeated) | Technology and category chips |
| `date` | **absent** | Listing cards render no date whatsoever |

### Trap 1: the "NOWA" badge lives inside the title element

Recent postings carry a badge span *inside* the `<h3>`:

```html
<h3 data-cy="title position on the job offer listing"> Senior QA Specialist
  <span data-cy="sup" class="title-badge title-badge--new"> NOWA </span><!----></h3>
```

Stripping tags without removing that span first yields titles like
`"Senior QA Automation Specialist - KRAKÓW NOWA"`. The parser removes any
`<span data-cy="sup" ...>` before cleaning, and reports the badge separately as `isNew`.

### Trap 2: never parse numbers out of raw markup

Angular decorates elements with numeric component ids (`_nghost-serverapp-c4252321822`).
An early version of `parseSalaryText` read digits from the captured HTML and produced a
**4,252,321,822 PLN** salary for cards that publish no figure. `parseSalaryText` now strips
tags before reading any digits, and there is a regression test for exactly this string.

Salary text notes: thousands separators are non-breaking spaces (`&nbsp;` / U+00A0), the range
dash may be an en dash or a hyphen, and hourly rates say `godz`. When no figure can be read
the result is `null` rather than a partial guess.

## Detail

```
GET https://nofluffjobs.com/pl/job/<slug>
```

Parsed from the page's **`ld+json` schema.org `JobPosting`** block (`parseLdJobPosting`),
which yields `title`, `datePosted`, `employmentType`, `validThrough`, `baseSalary`,
`hiringOrganization.name`, and `description` (real HTML, so bullets and paragraphs survive).

**`jobLocation` is frequently `null`** on this portal, remote postings especially. The page
still renders the location, so `parseDetailLocation` recovers it from
`data-cy="location_pin"` (office address, e.g. `Wrocław, Legnicka 16`) or
`data-cy="location_remote"` (`Praca zdalna`). Without that fallback, `detail` would lose a
field that `search` already had.

**A detail page also contains ~10 listing cards** in its "other offers" sidebar, all carrying
the same `data-cy` hooks as a search page. Running `parseJobCards` on a detail page would
therefore return the sidebar, not the posting - `detail` deliberately uses ld+json only.

`baseSalary.value` may carry either `minValue`/`maxValue` or a single `value`; both shapes are
handled.

## Pagination

`?page=N` renders pages 1..N **cumulatively**: page 1 returns 20 cards, `?page=2` returns 40
(the same 20 plus 20 new), verified by comparing slug sets (20 unique, 20 shared, 20 new).

The CLI fetches `?page=N` and slices off the first `(N-1) * 20` results, so `--page` behaves
like a page for the caller: one request, no duplicates when iterating pages. `meta.renderedTotal`
reports how many cards the page actually contained, so the cumulative behaviour stays visible.

Consequence worth knowing: requesting page 5 downloads pages 1-5. Deep paging is proportionally
more expensive, which is another reason to keep volume low.

## Unsupported flags

- **`--jobage`** exits 1 with `JOBAGE_UNSUPPORTED`. Listing cards carry no date, and the portal
  exposes no age parameter on an allowed path, so any age filter would either be a silent no-op
  or require fetching every posting's detail page. Use `justjoinit-search` when recency
  filtering matters, or call `detail` for a specific posting's date.

## If parsing breaks

- **`NO_RESULTS` on a query that works in a browser** - the `data-cy` hooks or the
  `nfj-postings-item` marker changed. An empty parse is reported as an error rather than a
  confident zero precisely because it is indistinguishable from broken selectors.
- **Titles carrying badge text** - a new badge variant was added; extend the `data-cy="sup"` strip.
- **Absurd salary figures** - something is reading digits from markup again. See Trap 2.
- **`PARSE_FAILED` on detail** - the ld+json `JobPosting` block moved or was removed.
