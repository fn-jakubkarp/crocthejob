// Data source: justjoin.it public job-offer listing pages (https://justjoin.it/job-offers/...).
//
// IMPORTANT — robots.txt: justjoin.it disallows /api/, and api.justjoin.it disallows
// everything except a few marketing paths. This CLI therefore never touches the JSON API.
// It reads the *public HTML pages*, which are allowed, and parses the React Server
// Component payload those pages already embed (`self.__next_f.push([1, "..."])` chunks).
// The payload carries the same fully-structured offer objects the page renders from, so
// no DOM parsing or headless browser is needed.
//
// Detail pages additionally expose a schema.org JobPosting block in ld+json, which is a
// cleaner source for the description than the RSC payload.

export const BASE = "https://justjoin.it"
export const SEARCH_BASE = `${BASE}/job-offers`
export const DETAIL_BASE = `${BASE}/job-offer`

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
  type: string | null
  from: number | null
  to: number | null
  currency: string | null
  unit: string | null
  gross: boolean | null
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  /** Primary city, as the portal labels the offer. */
  location: string | null
  /**
   * Every city the offer is open in. A location-filtered search legitimately returns
   * offers whose primary `location` is a different city, because the offer is also
   * open in the city searched for — this field is what explains that.
   */
  locations: string[] | null
  date: string | null
  url: string
  salary: Salary | null
  experienceLevel: string | null
  workplaceType: string | null
  remote: boolean | null
  skills: string[] | null
}

export interface JobDetail extends JobCard {
  description: string | null
  employmentType: string | null
  validThrough: string | null
  applyUrl: string | null
  niceToHaveSkills: string[] | null
  /** e.g. ["en (B2)", "pl (C1)"] — the offer's stated language requirements. */
  languages: string[] | null
  companyUrl: string | null
  companySize: string | null
  street: string | null
  /** Office days per week when the offer is hybrid. */
  officeDays: number | null
  expiredAt: string | null
}

/**
 * Concatenate the Next.js RSC streaming payload out of a page's HTML.
 *
 * The framework emits the payload as many `self.__next_f.push([1, "<json-escaped>"])`
 * calls; a single offer object can straddle a chunk boundary, so the chunks must be
 * unescaped and joined in document order before anything is parsed out of them.
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
 * Return the JSON object text starting at `open` (which must index a `{`), tracking
 * string state and escapes so braces inside string values cannot unbalance the scan.
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

function pickSalary(raw: unknown): Salary | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  // Offers carry the same range converted into several currencies; only the entry
  // flagged `original` is the employer's actual figure.
  const types = raw as Record<string, unknown>[]
  const chosen = types.find((e) => e && e.currencySource === "original") ?? types[0]
  if (!chosen) return null
  const num = (v: unknown): number | null => (typeof v === "number" ? v : null)
  return {
    type: typeof chosen.type === "string" ? chosen.type : null,
    from: num(chosen.from),
    to: num(chosen.to),
    currency: typeof chosen.currency === "string" ? chosen.currency : null,
    unit: typeof chosen.unit === "string" ? chosen.unit : null,
    gross: typeof chosen.gross === "boolean" ? chosen.gross : null,
  }
}

function toCard(o: Record<string, unknown>): JobCard {
  const slug = String(o.slug)
  const skills = Array.isArray(o.requiredSkills)
    ? (o.requiredSkills as unknown[])
        .map((s) => (typeof s === "string" ? s : (s as Record<string, unknown>)?.name))
        .filter((s): s is string => typeof s === "string")
    : null
  const workplaceType = typeof o.workplaceType === "string" ? o.workplaceType : null
  const cities = Array.isArray(o.multilocation)
    ? (o.multilocation as unknown[])
        .map((m) => (m as Record<string, unknown>)?.city)
        .filter((c): c is string => typeof c === "string")
    : null
  return {
    id: slug,
    title: String(o.title),
    company: typeof o.companyName === "string" ? o.companyName : null,
    location: typeof o.city === "string" ? o.city : null,
    locations: cities && cities.length > 0 ? cities : null,
    date: typeof o.publishedAt === "string" ? o.publishedAt : null,
    url: `${DETAIL_BASE}/${slug}`,
    salary: pickSalary(o.employmentTypes),
    experienceLevel: typeof o.experienceLevel === "string" ? o.experienceLevel : null,
    workplaceType,
    remote: workplaceType ? workplaceType === "remote" : null,
    skills: skills && skills.length > 0 ? skills : null,
  }
}

/**
 * Parse offer objects out of an RSC payload.
 *
 * Offer objects are serialized with alphabetically ordered keys, so each one starts
 * with the literal `{"applyUrl":` — that anchors the opening brace exactly. Every
 * candidate is parsed independently and validated, so an unrelated object that happens
 * to carry an `applyUrl` key (the detail page has one) is discarded rather than
 * corrupting the result set.
 */
export function parseOffers(payload: string): JobCard[] {
  const out: JobCard[] = []
  const seen = new Set<string>()
  const re = /\{"applyUrl":/g
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
    if (
      !o ||
      typeof o.slug !== "string" ||
      typeof o.title !== "string" ||
      typeof o.companyName !== "string"
    ) {
      continue
    }
    if (seen.has(o.slug)) continue
    seen.add(o.slug)
    out.push(toCard(o))
  }
  return out
}

/** Total offers matching the query, as reported by the page's own pagination meta. */
export function parseTotalItems(payload: string): number | null {
  const m = payload.match(/"totalItems":(\d+)/)
  return m ? parseInt(m[1], 10) : null
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

/** Flatten description HTML to readable text, preserving block breaks. */
export function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
  return decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * justjoin.it strips block markup out of the description before it reaches ld+json, so
 * the text arrives as one run-on block with sentence boundaries fused ("…business.Our
 * mission…"). The original paragraph breaks are not recoverable. This only re-inserts a
 * break where sentence-ending punctuation is immediately followed by a capital letter —
 * it never changes, drops, or reorders any words, and it is skipped entirely if the
 * source already has line breaks of its own.
 */
export function reflowRunOnText(text: string): string {
  if (text.includes("\n")) return text
  return text.replace(/([.!?:])([A-ZĄĆĘŁŃÓŚŹŻ])/g, "$1\n$2")
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

/**
 * Locate the detail page's own offer object in the RSC payload.
 *
 * A detail page serializes the offer differently from a listing card: it opens with
 * `{"slug":"<slug>","title":` and nests values that are flat on a card (`experienceLevel`
 * and `workplaceType` become `{label,value}`, `requiredSkills` become objects). It also
 * carries fields a card does not: languages, company size, street, hybrid schedule.
 */
export function parseDetailOffer(
  payload: string,
  slug: string,
): Record<string, unknown> | null {
  const anchor = `{"slug":"${slug}","title":`
  let from = 0
  for (;;) {
    const i = payload.indexOf(anchor, from)
    if (i === -1) return null
    const raw = sliceJsonObject(payload, i)
    if (raw) {
      try {
        const o = JSON.parse(raw) as Record<string, unknown>
        // multilocation entries also start with a slug+city, so require a real offer field.
        if (o && "companyName" in o) return o
      } catch {
        // fall through and keep looking
      }
    }
    from = i + 1
  }
}

/** Read a value that is either a plain string or a `{label,value}` wrapper. */
function labelOf(v: unknown): string | null {
  if (typeof v === "string") return v
  const o = v as Record<string, unknown> | null
  if (o && typeof o.label === "string") return o.label
  if (o && typeof o.value === "string") return o.value
  return null
}

function namesOf(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null
  const names = v
    .map((s) => (typeof s === "string" ? s : (s as Record<string, unknown>)?.name))
    .filter((s): s is string => typeof s === "string")
  return names.length > 0 ? names : null
}

/** Build a JobDetail from a detail page's ld+json plus its RSC offer object, if present. */
export function parseJobDetail(html: string, slug: string): JobDetail | null {
  const ld = parseLdJobPosting(html)
  const payload = extractRscPayload(html)
  const detailOffer = parseDetailOffer(payload, slug)
  const fromRsc =
    parseOffers(payload).find((o) => o.id === slug) ??
    (detailOffer
      ? {
          id: slug,
          title: typeof detailOffer.title === "string" ? detailOffer.title : "(untitled)",
          company:
            typeof detailOffer.companyName === "string" ? detailOffer.companyName : null,
          location: typeof detailOffer.city === "string" ? detailOffer.city : null,
          locations: Array.isArray(detailOffer.multilocation)
            ? ((detailOffer.multilocation as unknown[])
                .map((m) => (m as Record<string, unknown>)?.city)
                .filter((c): c is string => typeof c === "string") as string[])
              : null,
          date:
            typeof detailOffer.publishedAt === "string" ? detailOffer.publishedAt : null,
          url: `${DETAIL_BASE}/${slug}`,
          // Salary deliberately left null here: on a detail page `employmentTypes` leads
          // with a converted currency and carries no `currencySource`, so the ld+json
          // baseSalary below is the only trustworthy figure.
          salary: null,
          experienceLevel: labelOf(detailOffer.experienceLevel),
          workplaceType: labelOf(detailOffer.workplaceType),
          remote: labelOf(detailOffer.workplaceType)
            ? labelOf(detailOffer.workplaceType) === "remote"
            : null,
          skills: namesOf(detailOffer.requiredSkills),
        }
      : null)
  if (!ld && !fromRsc) return null

  const org = ld?.hiringOrganization as Record<string, unknown> | undefined
  const place = ld?.jobLocation as Record<string, unknown> | undefined
  const address = place?.address as Record<string, unknown> | undefined
  const salaryNode = ld?.baseSalary as Record<string, unknown> | undefined
  const salaryValue = salaryNode?.value as Record<string, unknown> | undefined

  const ldSalary: Salary | null = salaryNode
    ? {
        type: null,
        from: typeof salaryValue?.minValue === "number" ? salaryValue.minValue : null,
        to: typeof salaryValue?.maxValue === "number" ? salaryValue.maxValue : null,
        currency: typeof salaryNode.currency === "string" ? salaryNode.currency : null,
        unit:
          typeof salaryValue?.unitText === "string"
            ? String(salaryValue.unitText).toLowerCase()
            : null,
        gross: null,
      }
    : null

  const description =
    typeof ld?.description === "string"
      ? reflowRunOnText(htmlToText(ld.description)) || null
      : null

  const languages = Array.isArray(detailOffer?.languages)
    ? (detailOffer!.languages as Record<string, unknown>[])
        .map((l) =>
          typeof l?.code === "string"
            ? `${l.code}${typeof l.level === "string" ? ` (${l.level})` : ""}`
            : null,
        )
        .filter((l): l is string => l !== null)
    : null

  const hybrid = detailOffer?.hybridWorkSchedule as Record<string, unknown> | undefined

  return {
    id: slug,
    title:
      fromRsc?.title ??
      (typeof ld?.title === "string" ? ld.title.trim() : null) ??
      "(untitled)",
    company:
      fromRsc?.company ?? (typeof org?.name === "string" ? org.name : null) ?? null,
    location:
      fromRsc?.location ??
      (typeof address?.addressLocality === "string" ? address.addressLocality : null) ??
      null,
    locations: fromRsc?.locations ?? null,
    date:
      fromRsc?.date ?? (typeof ld?.datePosted === "string" ? ld.datePosted : null) ?? null,
    url: `${DETAIL_BASE}/${slug}`,
    // ld+json first: it reports the employer's own currency, unlike a detail page's
    // employmentTypes array (see the note in the fromRsc fallback above).
    salary: ldSalary ?? fromRsc?.salary ?? null,
    experienceLevel: fromRsc?.experienceLevel ?? null,
    workplaceType: fromRsc?.workplaceType ?? null,
    remote: fromRsc?.remote ?? null,
    skills: fromRsc?.skills ?? null,
    description,
    employmentType: typeof ld?.employmentType === "string" ? ld.employmentType : null,
    validThrough: typeof ld?.validThrough === "string" ? ld.validThrough : null,
    applyUrl:
      typeof detailOffer?.applyUrl === "string" && detailOffer.applyUrl.length > 0
        ? detailOffer.applyUrl
        : null,
    niceToHaveSkills: namesOf(detailOffer?.niceToHaveSkills),
    languages: languages && languages.length > 0 ? languages : null,
    companyUrl: typeof detailOffer?.companyUrl === "string" ? detailOffer.companyUrl : null,
    companySize: typeof detailOffer?.companySize === "string" ? detailOffer.companySize : null,
    street: typeof detailOffer?.street === "string" ? detailOffer.street : null,
    officeDays: typeof hybrid?.officeDays === "number" ? hybrid.officeDays : null,
    expiredAt: typeof detailOffer?.expiredAt === "string" ? detailOffer.expiredAt : null,
  }
}

/** Keep only offers published within the last `days` days. */
export function filterByAge(cards: JobCard[], days: number): JobCard[] {
  if (!days || days <= 0 || days >= 9999) return cards
  const cutoff = Date.now() - days * 86400000
  return cards.filter((c) => {
    if (!c.date) return true
    const t = Date.parse(c.date)
    return isNaN(t) ? true : t >= cutoff
  })
}

/** Normalize a human city name into a justjoin.it location path segment. */
export function locationSlug(input: string | undefined): string {
  if (!input) return "all-locations"
  const trimmed = input.trim().toLowerCase()
  if (trimmed === "" || trimmed === "all" || trimmed === "all-locations") {
    return "all-locations"
  }
  const map: Record<string, string> = {
    remote: "remote",
    zdalnie: "remote",
    cracow: "krakow",
    krakow: "krakow",
    "kraków": "krakow",
    warsaw: "warszawa",
    warszawa: "warszawa",
    "wroclaw": "wroclaw",
    "wrocław": "wroclaw",
    "poznan": "poznan",
    "poznań": "poznan",
    "gdansk": "gdansk",
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
