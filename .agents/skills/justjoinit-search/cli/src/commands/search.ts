import {
  SEARCH_BASE,
  htmlFetch,
  extractRscPayload,
  parseOffers,
  parseTotalItems,
  filterByAge,
  locationSlug,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  category?: string
  jobage: number
  experience?: string
  remote?: string
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

export function buildUrl(opts: SearchOpts): string {
  const segments = [locationSlug(opts.location)]
  if (opts.category) segments.push(opts.category.trim().toLowerCase())
  const params = new URLSearchParams()
  if (opts.query) params.set("keyword", opts.query)
  const qs = params.toString()
  return `${SEARCH_BASE}/${segments.join("/")}${qs ? `?${qs}` : ""}`
}

function money(c: JobCard): string {
  const s = c.salary
  if (!s || (s.from === null && s.to === null)) return "—"
  const fmt = (n: number) => Math.round(n).toLocaleString("en-US")
  const range =
    s.from !== null && s.to !== null
      ? `${fmt(s.from)}-${fmt(s.to)}`
      : fmt((s.from ?? s.to) as number)
  return `${range} ${s.currency ?? ""}${s.type ? ` ${s.type}` : ""}`.trim()
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const header =
    "TITLE".padEnd(40) +
    " " +
    "COMPANY".padEnd(22) +
    " " +
    "LOCATION".padEnd(14) +
    " " +
    "LEVEL".padEnd(7) +
    " " +
    "SALARY".padEnd(22) +
    " DATE"
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 40).padEnd(40)
    const company = (c.company || "—").slice(0, 22).padEnd(22)
    const loc = (c.location || "—").slice(0, 14).padEnd(14)
    const lvl = (c.experienceLevel || "—").slice(0, 7).padEnd(7)
    const sal = money(c).slice(0, 22).padEnd(22)
    const date = (c.date || "—").slice(0, 10)
    return `${title} ${company} ${loc} ${lvl} ${sal} ${date}`
  })
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  // A listing page server-renders only its first batch (~100 offers) and ignores a page
  // parameter; deeper pages are fetched client-side from the /api/ endpoints that
  // robots.txt disallows. Failing here is deliberate — silently re-serving page 1 would
  // look like new results to a caller that pages through.
  if (opts.page > 1) {
    writeError(
      "justjoin.it server-renders only the first ~100 offers per query and ignores a page parameter, so --page > 1 cannot be honoured. Narrow the search instead (--query, --category, --location, --experience).",
      "PAGE_UNSUPPORTED",
    )
    return 1
  }
  try {
    const url = buildUrl(opts)
    const html = await htmlFetch(url)
    if (!html) {
      writeError(`No page at ${url} (check --location / --category spelling)`, "NOT_FOUND")
      return 1
    }
    const payload = extractRscPayload(html)
    if (!payload) {
      writeError(
        "Could not find the embedded offer payload — justjoin.it markup may have changed (see url-reference.md)",
        "PARSE_FAILED",
      )
      return 1
    }
    const total = parseTotalItems(payload)
    let cards = parseOffers(payload)
    cards = filterByAge(cards, opts.jobage)
    if (opts.experience) {
      const want = opts.experience.trim().toLowerCase()
      cards = cards.filter((c) => (c.experienceLevel || "").toLowerCase() === want)
    }
    if (opts.remote) {
      const want = opts.remote.trim().toLowerCase()
      cards = cards.filter((c) => (c.workplaceType || "").toLowerCase() === want)
    }
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.experienceLevel || "—"} · ${money(c)}\n  ${c.date || "—"}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          {
            meta: { count: cards.length, page: opts.page, totalMatching: total },
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
