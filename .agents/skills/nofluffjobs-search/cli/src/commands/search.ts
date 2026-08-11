import {
  SEARCH_BASE,
  PAGE_SIZE,
  htmlFetch,
  parseJobCards,
  citySlug,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  jobage: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

export function buildUrl(opts: SearchOpts): string {
  // The keyword is a path segment on this portal, not a query parameter: `?criteria=`
  // is applied client-side only and returns an unfiltered page to a plain fetch.
  const keyword = (opts.query ?? "").trim()
  const segments: string[] = []
  if (keyword) segments.push(encodeURIComponent(keyword))
  const city = citySlug(opts.location)
  if (city) {
    // A city cannot be the only segment — it would read as the keyword — so an
    // unqualified city search is expressed as the portal's own "all offers" keyword.
    if (segments.length === 0) segments.push("praca-it")
    segments.push(city)
  }
  const params = new URLSearchParams()
  if (opts.page > 1) params.set("page", String(opts.page))
  const qs = params.toString()
  const path = segments.length > 0 ? `/${segments.join("/")}` : ""
  return `${SEARCH_BASE}${path}${qs ? `?${qs}` : ""}`
}

function money(c: JobCard): string {
  const s = c.salary
  if (!s || (s.from === null && s.to === null)) return "—"
  const fmt = (n: number) => Math.round(n).toLocaleString("en-US")
  const range =
    s.from !== null && s.to !== null
      ? `${fmt(s.from)}-${fmt(s.to)}`
      : fmt((s.from ?? s.to) as number)
  return `${range} ${s.currency ?? ""}`.trim()
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const header =
    "TITLE".padEnd(44) +
    " " +
    "COMPANY".padEnd(24) +
    " " +
    "LOCATION".padEnd(18) +
    " " +
    "SALARY".padEnd(20) +
    " TAGS"
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 44).padEnd(44)
    const company = (c.company || "—").slice(0, 24).padEnd(24)
    const loc = (c.location || "—").slice(0, 18).padEnd(18)
    const sal = money(c).slice(0, 20).padEnd(20)
    const tags = (c.tags ?? []).slice(0, 3).join(", ")
    return `${title} ${company} ${loc} ${sal} ${tags}`
  })
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  if (opts.jobage !== 9999) {
    writeError(
      "No Fluff Jobs listing cards do not render a posting date, so --jobage cannot be honoured on search. Run `detail <id>` for a posting's date, or use justjoinit-search when recency filtering matters.",
      "JOBAGE_UNSUPPORTED",
    )
    return 1
  }
  try {
    const url = buildUrl(opts)
    const html = await htmlFetch(url)
    if (!html) {
      writeError(`No page at ${url}`, "NOT_FOUND")
      return 1
    }
    const all = parseJobCards(html)
    if (all.length === 0) {
      // An empty parse on a 200 is ambiguous: a genuinely empty result set looks the
      // same as broken selectors, so say so rather than reporting a confident zero.
      writeError(
        `No job cards found at ${url}. Either the query has no matches, or the listing markup changed (see url-reference.md).`,
        "NO_RESULTS",
      )
      return 1
    }

    // Requesting page N server-renders pages 1..N cumulatively, so slicing off the
    // earlier pages is what makes `--page` behave like a page for the caller.
    let cards = opts.page > 1 ? all.slice((opts.page - 1) * PAGE_SIZE) : all
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${money(c)}\n  ${(c.tags ?? []).join(", ")}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          {
            meta: { count: cards.length, page: opts.page, renderedTotal: all.length },
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
