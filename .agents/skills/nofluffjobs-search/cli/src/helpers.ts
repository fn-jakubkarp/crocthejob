// Data source: No Fluff Jobs public server-rendered listing and job pages
// (https://nofluffjobs.com/pl/<keyword>[/<city>]).
//
// IMPORTANT — robots.txt: nofluffjobs.com disallows /api/, /posting/ and every localized
// /<lang>/posting/ path. This CLI therefore never calls the JSON API or a /posting/ URL.
// It reads only the allowed paths: the Angular-SSR listing pages and /pl/job/<slug>
// detail pages, both of which are fully server-rendered HTML.
//
// Listing cards are parsed from stable `data-cy` attributes (the portal's own e2e test
// hooks, which are far more durable than CSS classes). Detail pages additionally carry a
// schema.org JobPosting block in ld+json, which is where the posting date and structured
// salary come from — the listing cards do not render a date at all.

export const BASE = "https://nofluffjobs.com"
export const SEARCH_BASE = `${BASE}/pl`
export const DETAIL_BASE = `${BASE}/pl/job`

/** Listing cards render 20 offers per page, cumulatively (see PAGE_SIZE use in search). */
export const PAGE_SIZE = 20

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
  unit: string | null
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  /** null on search results: listing cards do not render a date. Present on `detail`. */
  date: string | null
  url: string
  salary: Salary | null
  tags: string[] | null
  /** True when the portal badges the posting as new ("NOWA"). null on `detail`. */
  isNew: boolean | null
}

export interface JobDetail extends JobCard {
  description: string | null
  employmentType: string | null
  validThrough: string | null
  seniority: string | null
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    // Salary figures are printed with non-breaking spaces as thousands separators.
    .replace(/&nbsp;/g, " ")
    .replace(/\u00a0/g, " ")
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ")
}

function clean(html: string): string {
  return decodeHtmlEntities(stripTags(html)).replace(/\s+/g, " ").trim()
}

/** Flatten description HTML to readable text, preserving block breaks and bullets. */
export function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|li|ul|ol|div|h\d|tr)>/gi, "\n")
  return decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * Parse a printed salary range such as `11 760 – 16 800  PLN` or `16 800 PLN`.
 *
 * Thousands separators are spaces (often non-breaking), and the range dash may be an
 * en dash or a hyphen. Returns null when no figure can be read, never a partial guess.
 */
export function parseSalaryText(raw: string): Salary | null {
  // Tags must go first. Angular decorates elements with numeric component ids
  // (`_nghost-serverapp-c4252321822`), so reading digits out of raw markup invents
  // salaries like 4,252,321,822 for cards that publish no figure at all.
  const text = clean(raw)
  if (!text) return null
  const currency = text.match(/\b(PLN|EUR|USD|GBP|CHF|CZK|HUF|UAH)\b/i)?.[1]?.toUpperCase() ?? null
  // Strip the currency so its letters cannot be mistaken for digits, then read the numbers.
  const numbers = text
    .replace(/\b(PLN|EUR|USD|GBP|CHF|CZK|HUF|UAH)\b/gi, "")
    .match(/\d[\d ]*\d|\d/g)
  if (!numbers || numbers.length === 0) return null
  const values = numbers.map((n) => parseInt(n.replace(/ /g, ""), 10)).filter((n) => !isNaN(n))
  if (values.length === 0) return null
  const unit = /\bgodz|\bh\b|hour/i.test(text) ? "hour" : "month"
  return {
    from: values[0] ?? null,
    to: values.length > 1 ? values[values.length - 1] : null,
    currency,
    unit,
  }
}

/**
 * Parse the listing page's job cards.
 *
 * Each card is an `<a nfj-postings-item ...>` element. The HTML is split on that marker so
 * every card is parsed from its own chunk and one malformed card cannot break the rest.
 * Fields are anchored on `data-cy` attributes, which are the portal's e2e test hooks and
 * survive styling changes that would break class-based selectors.
 */
export function parseJobCards(html: string): JobCard[] {
  const out: JobCard[] = []
  const seen = new Set<string>()
  const chunks = html.split(/nfj-postings-item/).slice(1)

  for (const chunk of chunks) {
    const slug = chunk.match(/href="\/pl\/job\/([a-z0-9-]+)"/i)?.[1]
    if (!slug || seen.has(slug)) continue

    const titleRaw = chunk.match(
      /data-cy="title position on the job offer listing"[^>]*>([\s\S]*?)<\/h3>/i,
    )?.[1]
    // The title element also holds a `data-cy="sup"` badge span ("NOWA") for recent
    // postings. Stripping tags without removing it first appends the badge text to the
    // job title, so the badge is removed here and kept as a flag instead.
    const isNew = titleRaw ? /data-cy="sup"[^>]*title-badge--new/i.test(titleRaw) : null
    const title = titleRaw
      ? clean(titleRaw.replace(/<span[^>]*data-cy="sup"[^>]*>[\s\S]*?<\/span>/gi, ""))
      : null
    if (!title) continue

    const companyRaw = chunk.match(/<h4[^>]*class="[^"]*company-name[^"]*"[^>]*>([\s\S]*?)<\/h4>/i)?.[1]
    const company = companyRaw ? clean(companyRaw) || null : null

    const cityRaw = chunk.match(
      /<nfj-posting-item-city[\s\S]*?<\/nfj-posting-item-city>/i,
    )?.[0]
    const location = cityRaw ? clean(cityRaw) || null : null

    const salaryRaw = chunk.match(
      /data-cy="salary ranges on the job offer listing"[^>]*>([\s\S]*?)<\/span>/i,
    )?.[1]
    const salary = salaryRaw ? parseSalaryText(salaryRaw) : null

    const tags: string[] = []
    const tagRe = /data-cy="category name on the job offer listing"[^>]*>([\s\S]*?)<\/span>/gi
    let tm: RegExpExecArray | null
    while ((tm = tagRe.exec(chunk)) !== null) {
      const t = clean(tm[1])
      if (t) tags.push(t)
    }

    seen.add(slug)
    out.push({
      id: slug,
      title,
      company,
      location,
      // Listing cards genuinely carry no date; `detail` supplies it from ld+json.
      date: null,
      url: `${DETAIL_BASE}/${slug}`,
      salary,
      tags: tags.length > 0 ? tags : null,
      isNew,
    })
  }

  return out
}

/**
 * Read the posting's own location off a detail page.
 *
 * The ld+json `jobLocation` is frequently null on this portal (remote postings in
 * particular), but the page itself always renders the location, either as an office
 * address (`data-cy="location_pin"`) or as a remote label (`data-cy="location_remote"`).
 * Both are read here so `detail` does not lose a field that `search` already had.
 */
export function parseDetailLocation(html: string): string | null {
  const pin = html.match(
    /data-cy="location_pin"[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>/i,
  )?.[1]
  if (pin) {
    const text = clean(pin)
    if (text) return text
  }
  const remote = html.match(/data-cy="location_remote"[^>]*>([^<]{2,60})/i)?.[1]
  if (remote) {
    const text = clean(remote)
    if (text) return text
  }
  return null
}

/** Extract the schema.org JobPosting node from a page's ld+json blocks. */
export function parseLdJobPosting(html: string): Record<string, unknown> | null {
  const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    let parsed: unknown
    try {
      parsed = JSON.parse(m[1])
    } catch {
      continue
    }
    const root = parsed as Record<string, unknown>
    const nodes = Array.isArray(root?.["@graph"])
      ? (root["@graph"] as Record<string, unknown>[])
      : [root]
    for (const n of nodes) {
      if (n && n["@type"] === "JobPosting") return n
    }
  }
  return null
}

/** Build a JobDetail from a /pl/job/<slug> page. */
export function parseJobDetail(html: string, slug: string): JobDetail | null {
  const ld = parseLdJobPosting(html)
  if (!ld) return null

  const org = ld.hiringOrganization as Record<string, unknown> | undefined
  const place = ld.jobLocation as Record<string, unknown> | undefined
  const address = place?.address as Record<string, unknown> | undefined
  const salaryNode = ld.baseSalary as Record<string, unknown> | undefined
  const salaryValue = salaryNode?.value as Record<string, unknown> | undefined

  const num = (v: unknown): number | null => (typeof v === "number" ? v : null)
  const salary: Salary | null = salaryNode
    ? {
        from: num(salaryValue?.minValue) ?? num(salaryValue?.value),
        to: num(salaryValue?.maxValue),
        currency: typeof salaryNode.currency === "string" ? salaryNode.currency : null,
        unit:
          typeof salaryValue?.unitText === "string"
            ? String(salaryValue.unitText).toLowerCase()
            : null,
      }
    : null

  return {
    id: slug,
    title: typeof ld.title === "string" ? ld.title.trim() : "(untitled)",
    company: typeof org?.name === "string" ? org.name : null,
    location:
      (typeof address?.addressLocality === "string" ? address.addressLocality : null) ??
      parseDetailLocation(html),
    date: typeof ld.datePosted === "string" ? ld.datePosted : null,
    url: `${DETAIL_BASE}/${slug}`,
    salary,
    tags: null,
    isNew: null,
    description: typeof ld.description === "string" ? htmlToText(ld.description) || null : null,
    employmentType: typeof ld.employmentType === "string" ? ld.employmentType : null,
    validThrough: typeof ld.validThrough === "string" ? ld.validThrough : null,
    seniority:
      typeof ld.experienceRequirements === "string" ? ld.experienceRequirements : null,
  }
}

/** Normalize a city name into a No Fluff Jobs path segment. */
export function citySlug(input: string | undefined): string | null {
  if (!input) return null
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) return null
  const map: Record<string, string> = {
    remote: "praca-zdalna",
    zdalnie: "praca-zdalna",
    "praca-zdalna": "praca-zdalna",
    cracow: "krakow",
    krakow: "krakow",
    "kraków": "krakow",
    warsaw: "warszawa",
    warszawa: "warszawa",
    wroclaw: "wroclaw",
    "wrocław": "wroclaw",
    poznan: "poznan",
    "poznań": "poznan",
    gdansk: "gdansk",
    "gdańsk": "gdansk",
    katowice: "katowice",
    lodz: "lodz",
    "łódź": "lodz",
  }
  if (map[trimmed]) return map[trimmed]
  return trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
