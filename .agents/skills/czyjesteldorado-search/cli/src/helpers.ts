// Data source: czyjesteldorado.pl public category pages (https://czyjesteldorado.pl/praca/kategoria/<slug>).
//
// czyjesteldorado.pl ("Czy Jest Eldorado") is an aggregator: it republishes IT postings
// collected from Pracuj.pl, No Fluff Jobs and employers directly, normalizing salary,
// seniority, work mode and contract type across all of them. Every job object carries the
// `source` it came from, which matters when deduplicating against nofluffjobs-search.
//
// IMPORTANT — robots.txt: the site disallows /api/ and /redirect/. This CLI never calls
// either. In particular each job object's own `url` field is a `/redirect/<uid>` link, which
// is disallowed, so detail URLs are always rebuilt as the allowed `/praca/<id>-<slug>` form.
//
// The real search box posts to /api/, so keyword search is not reachable from an allowed
// path. Category pages are, and they server-render the 10 newest postings of a category
// inside the Next.js RSC payload. That is the whole usable surface — see url-reference.md.

export const BASE = "https://czyjesteldorado.pl"
export const CATEGORY_BASE = `${BASE}/praca/kategoria`
export const DETAIL_BASE = `${BASE}/praca`

/** Server-rendered postings per category page. Not configurable; there is no pagination. */
export const RENDERED_PER_CATEGORY = 10

/** Every category slug the portal publishes, read off its own navigation. */
export const CATEGORIES = [
  "admin",
  "agile",
  "ai",
  "architecture",
  "backend",
  "bi",
  "blockchain",
  "business-analytics",
  "cloud-engineering",
  "data-engineering",
  "data-science",
  "devops",
  "embedded",
  "erp",
  "frontend",
  "fullstack",
  "game",
  "helpdesk",
  "low-code",
  "low-level",
  "management",
  "mobile",
  "other",
  "product-management",
  "project-management",
  "security",
  "support",
  "system-analytics",
  "testing",
  "uxui",
] as const

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

/** Fetch HTML with exponential backoff on 429/5xx. Returns "" on a 404. */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return ""
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.text()
  }
  throw new Error("Request failed after max retries")
}

export interface Salary {
  from: number | null
  to: number | null
  currency: string | null
  /** `hour` or `month`, as the source states it. */
  unit: string | null
  /** Contract the figure applies to, e.g. `b2b`, `permanent`. */
  type: string | null
  /** True when the portal estimated the figure rather than reading it from the posting. */
  isEstimated: boolean | null
}

export interface JobCard {
  /** `<numericId>-<slug>`, which is also the detail path segment. Pass straight to `detail`. */
  id: string
  numericId: number | null
  title: string
  company: string | null
  location: string | null
  locations: string[] | null
  date: string | null
  url: string
  salary: Salary | null
  /**
   * The portal's own monthly-PLN normalization of the salary. This is what makes an hourly
   * B2B rate comparable to a monthly employment figure, so it is the field to rank on.
   */
  normalizedMonthlyPln: { min: number | null; max: number | null } | null
  seniority: string | null
  workModes: string[] | null
  contractTypes: string[] | null
  remote: boolean | null
  keywords: string[] | null
  categories: string[] | null
  /** Which board or employer the aggregator took this posting from. */
  source: string | null
  isNew: boolean | null
  /** True for paid placements. Category pages return organic results; city pages do not. */
  isFeatured: boolean | null
  summary: string | null
}

export interface JobDetail extends JobCard {
  description: string | null
  descriptionSections: Record<string, string> | null
  companySize: string | null
  companySectors: string[] | null
  workloadTypes: string[] | null
  benefits: string[] | null
  isExpired: boolean | null
}

/**
 * Concatenate the Next.js RSC streaming payload out of a page's HTML.
 *
 * The payload arrives as many `self.__next_f.push([1, "<json-escaped>"])` calls and a single
 * job object can straddle a chunk boundary, so chunks must be unescaped and joined in
 * document order before anything is parsed out of them.
 */
export function extractRscPayload(html: string): string {
  const re = /self\.__next_f\.push\(\[1,\s*("(?:[^"\\]|\\.)*")\]\)/g
  const parts: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    try {
      const decoded = JSON.parse(m[1]) as unknown
      if (typeof decoded === "string") parts.push(decoded)
    } catch {
      // A malformed chunk is skipped rather than aborting the whole payload.
    }
  }
  return parts.join("")
}

/**
 * Return the JSON object text starting at `open` (which must index a `{`), tracking string
 * state and escapes so braces inside string values cannot unbalance the scan.
 */
export function sliceJsonObject(text: string, open: number): string | null {
  if (text[open] !== "{") return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === "\\") esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === "{") depth++
    else if (c === "}") {
      depth--
      if (depth === 0) return text.slice(open, i + 1)
    }
  }
  return null
}

/** Total postings the portal reports for the rendered category, not just the 10 shown. */
export function parseResultsCount(payload: string): number | null {
  const m = payload.match(/"resultsCount":(\d+)/)
  return m ? parseInt(m[1], 10) : null
}

function strArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null
  const out = v.filter((x): x is string => typeof x === "string")
  return out.length > 0 ? out : null
}

function pickSalary(raw: unknown): Salary | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const entries = raw as Record<string, unknown>[]
  // Prefer a figure the source actually published over one the portal estimated.
  const chosen = entries.find((e) => e && e.isEstimated === false) ?? entries[0]
  if (!chosen) return null
  const num = (v: unknown): number | null => (typeof v === "number" ? v : null)
  return {
    from: num(chosen.min),
    to: num(chosen.max),
    currency: typeof chosen.currency === "string" ? chosen.currency : null,
    unit: typeof chosen.period === "string" ? chosen.period : null,
    type: typeof chosen.contractType === "string" ? chosen.contractType : null,
    isEstimated: typeof chosen.isEstimated === "boolean" ? chosen.isEstimated : null,
  }
}

/** `postedAt` is a Unix timestamp in **seconds**, not milliseconds. */
export function postedAtToIso(v: unknown): string | null {
  if (typeof v !== "number" || !isFinite(v) || v <= 0) return null
  return new Date(v * 1000).toISOString()
}

const SECTION_ORDER = [
  "summary",
  "about",
  "responsibilities",
  "requirements",
  "benefits",
  "other",
] as const

function sections(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null
  const src = v as Record<string, unknown>
  const out: Record<string, string> = {}
  for (const key of Object.keys(src)) {
    const val = src[key]
    if (typeof val === "string" && val.trim() !== "") out[key] = val.trim()
  }
  return Object.keys(out).length > 0 ? out : null
}

/** Flatten the structured description into readable text with section headings. */
export function sectionsToText(secs: Record<string, string> | null): string | null {
  if (!secs) return null
  const seen = new Set<string>()
  const parts: string[] = []
  const push = (key: string) => {
    const body = secs[key]
    if (!body || seen.has(key)) return
    seen.add(key)
    // `summary` reads as the lede, so it is emitted without a heading.
    parts.push(key === "summary" ? body : `${key.toUpperCase()}\n${body}`)
  }
  for (const key of SECTION_ORDER) push(key)
  for (const key of Object.keys(secs)) push(key)
  const text = parts.join("\n\n").trim()
  return text === "" ? null : text
}

function toCard(o: Record<string, unknown>): JobCard | null {
  const numericId = typeof o.id === "number" ? o.id : null
  const slug = typeof o.slug === "string" ? o.slug : null
  const title = typeof o.title === "string" ? o.title : null
  if (numericId === null || !slug || !title) return null

  const company = o.company as Record<string, unknown> | undefined
  const cities = strArray(o.cities)
  const isRemote = typeof o.isRemote === "boolean" ? o.isRemote : null
  const secs = sections(o.description)
  const nMin = typeof o.normalizedSalaryMin === "number" ? o.normalizedSalaryMin : null
  const nMax = typeof o.normalizedSalaryMax === "number" ? o.normalizedSalaryMax : null

  return {
    id: `${numericId}-${slug}`,
    numericId,
    title,
    company: typeof company?.name === "string" ? company.name : null,
    // A fully remote posting legitimately has no city; say "Remote" rather than null so the
    // field carries the same meaning it does on the other portals.
    location: cities?.[0] ?? (isRemote ? "Remote" : null),
    locations: cities,
    date: postedAtToIso(o.postedAt),
    // Never the object's own `url` field: that is a /redirect/<uid> link, disallowed by robots.txt.
    url: `${DETAIL_BASE}/${numericId}-${slug}`,
    salary: pickSalary(o.salary),
    normalizedMonthlyPln: nMin !== null || nMax !== null ? { min: nMin, max: nMax } : null,
    seniority: typeof o.seniority === "string" ? o.seniority : null,
    workModes: strArray(o.workModes),
    contractTypes: strArray(o.contractTypes),
    remote: isRemote,
    keywords: strArray(o.keywords),
    categories: strArray(o.categories),
    source: typeof o.source === "string" ? o.source : null,
    isNew: typeof o.isNew === "boolean" ? o.isNew : null,
    isFeatured: typeof o.isFeatured === "boolean" ? o.isFeatured : null,
    summary: secs?.summary ?? null,
  }
}

/**
 * Parse job objects out of an RSC payload.
 *
 * Job objects are serialized with `id` first and `uid` second, so each begins with the
 * literal `{"id":<digits>,"uid":"` — that anchors the opening brace precisely and avoids
 * matching the unrelated `{"id":"gtm-..."}` analytics objects on the same page (whose id is
 * a string, not a number). Every candidate is parsed and validated on its own.
 */
export function parseJobs(payload: string): JobCard[] {
  const out: JobCard[] = []
  const seen = new Set<string>()
  const re = /\{"id":\d+,"uid":"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(payload)) !== null) {
    const raw = sliceJsonObject(payload, m.index)
    if (!raw) continue
    let o: Record<string, unknown>
    try {
      o = JSON.parse(raw) as Record<string, unknown>
    } catch {
      continue
    }
    const card = toCard(o)
    if (!card || seen.has(card.id)) continue
    seen.add(card.id)
    out.push(card)
  }
  return out
}

/** Build a JobDetail from a `/praca/<id>-<slug>` page. */
export function parseJobDetail(html: string, id: string): JobDetail | null {
  const payload = extractRscPayload(html)
  const numericId = parseInt(id.split("-")[0] ?? "", 10)
  const jobs = parseJobs(payload)
  // A detail page also renders "similar offers", so match on the requested id rather than
  // taking the first job object on the page.
  const card =
    jobs.find((j) => j.id === id) ??
    (isNaN(numericId) ? undefined : jobs.find((j) => j.numericId === numericId))
  if (!card) return null

  // Re-read the raw object for the fields the card shape drops.
  let rawObj: Record<string, unknown> | null = null
  const anchor = `{"id":${card.numericId},"uid":"`
  const i = payload.indexOf(anchor)
  if (i !== -1) {
    const raw = sliceJsonObject(payload, i)
    if (raw) {
      try {
        rawObj = JSON.parse(raw) as Record<string, unknown>
      } catch {
        rawObj = null
      }
    }
  }
  const secs = sections(rawObj?.description)
  const company = rawObj?.company as Record<string, unknown> | undefined

  return {
    ...card,
    description: sectionsToText(secs),
    descriptionSections: secs,
    companySize: typeof company?.size === "string" ? company.size : null,
    companySectors: strArray(company?.sectors),
    workloadTypes: strArray(rawObj?.workloadTypes),
    benefits: strArray(rawObj?.benefits),
    isExpired: typeof rawObj?.isExpired === "boolean" ? rawObj.isExpired : null,
  }
}

/** Keep only postings published within the last `days` days. */
export function filterByAge(cards: JobCard[], days: number): JobCard[] {
  if (!days || days <= 0 || days >= 9999) return cards
  const cutoff = Date.now() - days * 86400000
  return cards.filter((c) => {
    if (!c.date) return true
    const t = Date.parse(c.date)
    return isNaN(t) ? true : t >= cutoff
  })
}

/** Case- and diacritic-insensitive comparison key. */
export function foldCase(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
}

/**
 * Keyword filter applied client-side, because the portal's own search posts to the
 * disallowed /api/. Matches title, keywords, roles, company and summary.
 */
export function filterByQuery(cards: JobCard[], query: string | undefined): JobCard[] {
  const q = (query ?? "").trim()
  if (!q) return cards
  const terms = foldCase(q).split(/\s+/).filter(Boolean)
  return cards.filter((c) => {
    const haystack = foldCase(
      [c.title, c.company, c.summary, ...(c.keywords ?? []), ...(c.categories ?? [])]
        .filter(Boolean)
        .join(" "),
    )
    return terms.every((t) => haystack.includes(t))
  })
}

/** City filter applied client-side against the posting's own city list. */
export function filterByCity(cards: JobCard[], city: string | undefined): JobCard[] {
  const c = (city ?? "").trim()
  if (!c) return cards
  const want = foldCase(c)
  if (want === "remote" || want === "zdalnie") return cards.filter((j) => j.remote === true)
  return cards.filter((j) => (j.locations ?? []).some((l) => foldCase(l).includes(want)))
}
