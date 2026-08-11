import {
  CATEGORY_BASE,
  CATEGORIES,
  RENDERED_PER_CATEGORY,
  htmlFetch,
  extractRscPayload,
  parseJobs,
  parseResultsCount,
  filterByAge,
  filterByQuery,
  filterByCity,
  foldCase,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  categories: string[]
  query?: string
  city?: string
  seniority?: string
  remote?: boolean
  jobage: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

export function categoryUrl(category: string): string {
  return `${CATEGORY_BASE}/${category}`
}

/** Split and validate a comma-separated --category value. */
export function parseCategories(raw: string): { categories: string[]; invalid: string[] } {
  const wanted = raw
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean)
  const valid = new Set<string>(CATEGORIES)
  return {
    categories: wanted.filter((c) => valid.has(c)),
    invalid: wanted.filter((c) => !valid.has(c)),
  }
}

function money(c: JobCard): string {
  const n = c.normalizedMonthlyPln
  if (n && (n.min !== null || n.max !== null)) {
    const fmt = (v: number) => Math.round(v).toLocaleString("en-US")
    const range =
      n.min !== null && n.max !== null
        ? `${fmt(n.min)}-${fmt(n.max)}`
        : fmt((n.min ?? n.max) as number)
    const est = c.salary?.isEstimated ? "~" : ""
    return `${est}${range} PLN/mo`
  }
  const s = c.salary
  if (!s || (s.from === null && s.to === null)) return "—"
  const range = s.from !== null && s.to !== null ? `${s.from}-${s.to}` : `${s.from ?? s.to}`
  return `${range} ${s.currency ?? ""}/${s.unit ?? "?"}`.trim()
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const header =
    "TITLE".padEnd(40) +
    " " +
    "COMPANY".padEnd(20) +
    " " +
    "LOCATION".padEnd(14) +
    " " +
    "LEVEL".padEnd(8) +
    " " +
    "SALARY".padEnd(20) +
    " " +
    "SOURCE".padEnd(14) +
    " DATE"
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 40).padEnd(40)
    const company = (c.company || "—").slice(0, 20).padEnd(20)
    const loc = (c.location || "—").slice(0, 14).padEnd(14)
    const lvl = (c.seniority || "—").slice(0, 8).padEnd(8)
    const sal = money(c).slice(0, 20).padEnd(20)
    const src = (c.source || "—").slice(0, 14).padEnd(14)
    const date = (c.date || "—").slice(0, 10)
    return `${title} ${company} ${loc} ${lvl} ${sal} ${src} ${date}`
  })
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  // Category pages server-render a fixed newest-10 and ignore every pagination parameter
  // (`?strona=2` and `?page=2` both return byte-identical page-1 content). Failing loudly
  // beats handing back the same ten postings as if they were page two.
  if (opts.page > 1) {
    writeError(
      "czyjesteldorado.pl server-renders only the 10 newest postings per category and ignores pagination parameters, so --page > 1 cannot be honoured. Pass more categories, or run again later to pick up new postings.",
      "PAGE_UNSUPPORTED",
    )
    return 1
  }
  if (opts.categories.length === 0) {
    writeError(
      `--category is required (the portal's keyword search is not reachable from an allowed path). Valid categories: ${CATEGORIES.join(", ")}`,
      "NO_CATEGORY",
    )
    return 1
  }

  try {
    const perCategory: { category: string; rendered: number; resultsCount: number | null }[] = []
    const merged: JobCard[] = []
    const seen = new Set<string>()

    for (const category of opts.categories) {
      const url = categoryUrl(category)
      const html = await htmlFetch(url)
      if (!html) {
        writeError(`No page at ${url}`, "NOT_FOUND")
        return 1
      }
      const payload = extractRscPayload(html)
      if (!payload) {
        writeError(
          `Could not find the embedded job payload at ${url} — czyjesteldorado.pl markup may have changed (see url-reference.md)`,
          "PARSE_FAILED",
        )
        return 1
      }
      const jobs = parseJobs(payload)
      perCategory.push({
        category,
        rendered: jobs.length,
        resultsCount: parseResultsCount(payload),
      })
      for (const job of jobs) {
        // The same posting appears under several categories; keep the first copy.
        if (seen.has(job.id)) continue
        seen.add(job.id)
        merged.push(job)
      }
    }

    if (merged.length === 0) {
      writeError(
        "No job objects parsed from any requested category. Either every category page was empty, or the markup changed (see url-reference.md).",
        "NO_RESULTS",
      )
      return 1
    }

    let cards = filterByQuery(merged, opts.query)
    cards = filterByCity(cards, opts.city)
    if (opts.seniority) {
      const want = foldCase(opts.seniority)
      cards = cards.filter((c) => foldCase(c.seniority ?? "") === want)
    }
    if (opts.remote === true) cards = cards.filter((c) => c.remote === true)
    cards = filterByAge(cards, opts.jobage)
    cards.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    const matched = cards.length
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
      // Coverage is stated on stderr so it cannot be mistaken for a result row, and so a
      // caller never reads "6 results" as "6 postings exist".
      process.stderr.write(
        `\nShowing ${cards.length} of ${matched} matched, from the ${RENDERED_PER_CATEGORY} newest postings in each of: ${opts.categories.join(", ")}. ` +
          `The portal holds far more (${perCategory.map((p) => `${p.category}: ${p.resultsCount ?? "?"}`).join(", ")}) but only the newest ${RENDERED_PER_CATEGORY} per category are reachable without its disallowed API.\n`,
      )
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.seniority || "—"} · ${money(c)}\n  source: ${c.source || "—"} · ${c.date || "—"}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          {
            meta: {
              count: cards.length,
              page: 1,
              matched,
              renderedPerCategory: RENDERED_PER_CATEGORY,
              categories: perCategory,
              coverage:
                `Only the ${RENDERED_PER_CATEGORY} newest postings per category are server-rendered on an allowed path; ` +
                `resultsCount reports how many the portal actually holds. Deeper access needs its /api/, which robots.txt disallows.`,
            },
            results: cards,
          },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
