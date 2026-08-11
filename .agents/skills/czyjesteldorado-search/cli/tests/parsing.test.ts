import { describe, expect, test } from "bun:test"
import {
  extractRscPayload,
  sliceJsonObject,
  parseJobs,
  parseJobDetail,
  parseResultsCount,
  postedAtToIso,
  sectionsToText,
  filterByAge,
  filterByQuery,
  filterByCity,
  foldCase,
  CATEGORIES,
  type JobCard,
} from "../src/helpers.js"
import { categoryUrl, parseCategories } from "../src/commands/search.js"
import { normalizeId } from "../src/commands/detail.js"

/** A job object shaped exactly like the portal's own serialization (id first, uid second). */
function jobJson(over: Record<string, unknown> = {}): string {
  const base = {
    id: 398090,
    uid: "1CdWGCYPmbTxRW5ktkGeBu",
    title: "Tester Automatyzujący",
    url: "/redirect/1CdWGCYPmbTxRW5ktkGeBu",
    slug: "tester-automatyzujacy-itfs",
    company: { name: "ITFS", size: "enterprise", sectors: ["general_tech"], slug: "itfs" },
    seniority: "senior",
    workModes: ["hybrid"],
    workloadTypes: ["full_time"],
    contractTypes: ["b2b"],
    cities: ["Warszawa"],
    roles: ["test_automation_engineer"],
    benefits: ["private_health_care"],
    categories: ["testing"],
    keywords: ["API", "Playwright", "Java"],
    salary: [
      {
        contractType: "b2b",
        period: "hour",
        currency: "PLN",
        min: 110,
        max: 125,
        isEstimated: false,
      },
    ],
    normalizedSalaryMin: 18480,
    normalizedSalaryMax: 21000,
    postedAt: 1785311034,
    source: "ITFS",
    isNew: true,
    isFeatured: false,
    isRemote: false,
    isExpired: false,
    description: {
      about: "",
      summary: "Automatyzacja testów.",
      responsibilities: "- Testy API",
      requirements: "- Playwright",
      benefits: "- Prywatna opieka",
      other: "",
    },
    ...over,
  }
  return JSON.stringify(base)
}

function rscHtml(payload: string, chunkSize = 40): string {
  const chunks: string[] = []
  for (let i = 0; i < payload.length; i += chunkSize) {
    chunks.push(
      `<script>self.__next_f.push([1,${JSON.stringify(payload.slice(i, i + chunkSize))}])</script>`,
    )
  }
  return `<html><body>${chunks.join("")}</body></html>`
}

describe("extractRscPayload", () => {
  test("rejoins chunks that split a job object", () => {
    const payload = `{"jobs":[${jobJson()}],"page":1,"resultsCount":1415}`
    expect(extractRscPayload(rscHtml(payload, 23))).toBe(payload)
  })

  test("returns empty string when there is no payload", () => {
    expect(extractRscPayload("<html>nope</html>")).toBe("")
  })
})

describe("sliceJsonObject", () => {
  test("ignores braces inside strings and handles escapes", () => {
    const text = `{"a":"} {","b":"say \\"hi\\""}`
    expect(JSON.parse(sliceJsonObject(text, 0)!)).toEqual({ a: "} {", b: 'say "hi"' })
  })

  test("returns null on an unterminated object", () => {
    expect(sliceJsonObject('{"a":1', 0)).toBeNull()
  })
})

describe("parseJobs", () => {
  test("maps a job to the portal-skill result contract", () => {
    const cards = parseJobs(`"jobs":[${jobJson()}]`)
    expect(cards).toHaveLength(1)
    const c = cards[0]
    expect(c.id).toBe("398090-tester-automatyzujacy-itfs")
    expect(c.numericId).toBe(398090)
    expect(c.title).toBe("Tester Automatyzujący")
    expect(c.company).toBe("ITFS")
    expect(c.location).toBe("Warszawa")
    expect(c.locations).toEqual(["Warszawa"])
    expect(c.seniority).toBe("senior")
    expect(c.source).toBe("ITFS")
    expect(c.keywords).toEqual(["API", "Playwright", "Java"])
    expect(c.summary).toBe("Automatyzacja testów.")
  })

  test("never emits the robots-disallowed /redirect/ link", () => {
    const c = parseJobs(`[${jobJson()}]`)[0]
    expect(c.url).toBe("https://czyjesteldorado.pl/praca/398090-tester-automatyzujacy-itfs")
    expect(c.url).not.toContain("/redirect/")
  })

  test("converts postedAt seconds to an ISO date", () => {
    const c = parseJobs(`[${jobJson()}]`)[0]
    expect(c.date).toBe(new Date(1785311034 * 1000).toISOString())
  })

  test("keeps the source figure and the portal's monthly normalization", () => {
    const c = parseJobs(`[${jobJson()}]`)[0]
    expect(c.salary).toEqual({
      from: 110,
      to: 125,
      currency: "PLN",
      unit: "hour",
      type: "b2b",
      isEstimated: false,
    })
    // The normalization is what makes an hourly B2B rate comparable to a monthly figure.
    expect(c.normalizedMonthlyPln).toEqual({ min: 18480, max: 21000 })
  })

  test("prefers a published salary over one the portal estimated", () => {
    const c = parseJobs(
      `[${jobJson({
        salary: [
          { contractType: "b2b", period: "month", currency: "PLN", min: 1, max: 2, isEstimated: true },
          { contractType: "b2b", period: "month", currency: "PLN", min: 15000, max: 18000, isEstimated: false },
        ],
      })}]`,
    )[0]
    expect(c.salary?.from).toBe(15000)
    expect(c.salary?.isEstimated).toBe(false)
  })

  test("labels a remote posting with no city as Remote", () => {
    const c = parseJobs(`[${jobJson({ cities: [], isRemote: true })}]`)[0]
    expect(c.location).toBe("Remote")
    expect(c.locations).toBeNull()
    expect(c.remote).toBe(true)
  })

  test("ignores analytics objects whose id is a string", () => {
    const gtm = `{"id":"gtm-debug-runtime","children":[],"strategy":"lazy"}`
    const cards = parseJobs(`[${gtm},${jobJson()}]`)
    expect(cards).toHaveLength(1)
    expect(cards[0].company).toBe("ITFS")
  })

  test("deduplicates and survives a malformed object", () => {
    const broken = `{"id":1,"uid":"x","title":`
    const cards = parseJobs(`[${broken},${jobJson()},${jobJson()}]`)
    expect(cards).toHaveLength(1)
  })

  test("drops an object missing id, slug or title rather than emitting a partial", () => {
    expect(parseJobs(`[${jobJson({ slug: null })}]`)).toHaveLength(0)
    expect(parseJobs(`[${jobJson({ title: null })}]`)).toHaveLength(0)
  })

  test("missing optional values become null, never omitted", () => {
    const c = parseJobs(
      `[${jobJson({
        salary: [],
        normalizedSalaryMin: null,
        normalizedSalaryMax: null,
        keywords: [],
        seniority: null,
        postedAt: null,
        source: null,
        description: {},
      })}]`,
    )[0]
    expect(c.salary).toBeNull()
    expect(c.normalizedMonthlyPln).toBeNull()
    expect(c.keywords).toBeNull()
    expect(c.seniority).toBeNull()
    expect(c.date).toBeNull()
    expect(c.summary).toBeNull()
  })
})

describe("postedAtToIso", () => {
  test("treats the value as seconds, not milliseconds", () => {
    expect(postedAtToIso(1785311034)).toBe(new Date(1785311034 * 1000).toISOString())
    // Read as milliseconds this timestamp would land in 1970, so pin the year.
    expect(postedAtToIso(1785311034)!.startsWith("2026-")).toBe(true)
  })
  test("rejects non-numeric and non-positive input", () => {
    expect(postedAtToIso("2026-07-29")).toBeNull()
    expect(postedAtToIso(0)).toBeNull()
    expect(postedAtToIso(null)).toBeNull()
  })
})

describe("sectionsToText", () => {
  test("puts summary first with no heading and labels the rest", () => {
    const out = sectionsToText({
      requirements: "- Playwright",
      summary: "Lede sentence.",
      responsibilities: "- Testy",
    })!
    expect(out.startsWith("Lede sentence.")).toBe(true)
    expect(out).toContain("RESPONSIBILITIES\n- Testy")
    expect(out).toContain("REQUIREMENTS\n- Playwright")
    // Responsibilities must precede requirements, matching the portal's own reading order.
    expect(out.indexOf("RESPONSIBILITIES")).toBeLessThan(out.indexOf("REQUIREMENTS"))
  })

  test("includes unexpected section names rather than dropping them", () => {
    const out = sectionsToText({ summary: "S", weirdNewSection: "content" })!
    expect(out).toContain("WEIRDNEWSECTION\ncontent")
  })

  test("returns null for empty input", () => {
    expect(sectionsToText(null)).toBeNull()
    expect(sectionsToText({})).toBeNull()
  })
})

describe("parseResultsCount", () => {
  test("reads the portal's real total", () => {
    expect(parseResultsCount(`"page":1,"resultsCount":1415,"sort":"newest"`)).toBe(1415)
  })
  test("returns null when absent", () => {
    expect(parseResultsCount("{}")).toBeNull()
  })
})

describe("parseJobDetail", () => {
  const html = rscHtml(`"jobs":[${jobJson()},${jobJson({ id: 111111, slug: "other-job", uid: "z" })}]`)

  test("matches the requested id, not merely the first job on the page", () => {
    const d = parseJobDetail(html, "111111-other-job")!
    expect(d.numericId).toBe(111111)
  })

  test("flattens the description sections and exposes them raw", () => {
    const d = parseJobDetail(html, "398090-tester-automatyzujacy-itfs")!
    expect(d.description).toContain("Automatyzacja testów.")
    expect(d.description).toContain("REQUIREMENTS")
    expect(d.descriptionSections?.requirements).toBe("- Playwright")
    // Empty sections from the source must not appear as empty headings.
    expect(d.descriptionSections?.about).toBeUndefined()
  })

  test("carries company and workload metadata", () => {
    const d = parseJobDetail(html, "398090-tester-automatyzujacy-itfs")!
    expect(d.companySize).toBe("enterprise")
    expect(d.companySectors).toEqual(["general_tech"])
    expect(d.workloadTypes).toEqual(["full_time"])
    expect(d.isExpired).toBe(false)
  })

  test("returns null when the id is not on the page", () => {
    expect(parseJobDetail(html, "999999-nope")).toBeNull()
  })
})

describe("client-side filters", () => {
  // The first fixture is deliberately dated 2023 so the --jobage assertion below is not
  // hostage to the base fixture's timestamp drifting into the recent past.
  const cards = parseJobs(
    `[${jobJson({ postedAt: 1690000000 })},${jobJson({
      id: 2,
      uid: "b",
      slug: "devops-krakow",
      title: "Senior DevOps Engineer",
      cities: ["Kraków"],
      keywords: ["Kubernetes"],
      categories: ["devops"],
      seniority: "senior",
      isRemote: true,
      postedAt: Math.floor(Date.now() / 1000),
      description: { summary: "Infra." },
    })}]`,
  )

  test("query matches title, keywords and categories, requiring every term", () => {
    expect(filterByQuery(cards, "playwright").map((c) => c.numericId)).toEqual([398090])
    expect(filterByQuery(cards, "kubernetes").map((c) => c.numericId)).toEqual([2])
    expect(filterByQuery(cards, "senior devops").map((c) => c.numericId)).toEqual([2])
    expect(filterByQuery(cards, "playwright kubernetes")).toHaveLength(0)
  })

  test("query is diacritic- and case-insensitive", () => {
    expect(filterByQuery(cards, "TESTER automatyzujacy")).toHaveLength(1)
  })

  test("query with no value returns everything", () => {
    expect(filterByQuery(cards, undefined)).toHaveLength(2)
    expect(filterByQuery(cards, "   ")).toHaveLength(2)
  })

  test("city matches the posting's own city list, ignoring diacritics", () => {
    expect(filterByCity(cards, "krakow").map((c) => c.numericId)).toEqual([2])
    expect(filterByCity(cards, "Kraków").map((c) => c.numericId)).toEqual([2])
    expect(filterByCity(cards, "warszawa").map((c) => c.numericId)).toEqual([398090])
  })

  test("city 'remote' selects fully remote postings", () => {
    expect(filterByCity(cards, "remote").map((c) => c.numericId)).toEqual([2])
    expect(filterByCity(cards, "zdalnie").map((c) => c.numericId)).toEqual([2])
  })

  test("jobage drops stale postings but keeps undated ones", () => {
    const recent = filterByAge(cards, 1)
    expect(recent.map((c) => c.numericId)).toEqual([2])
    const undated = parseJobs(`[${jobJson({ postedAt: null })}]`)
    expect(filterByAge(undated, 1)).toHaveLength(1)
  })
})

describe("foldCase", () => {
  test("normalizes Polish characters", () => {
    expect(foldCase("Kraków")).toBe("krakow")
    expect(foldCase("Łódź")).toBe("lodz")
  })
})

describe("categories", () => {
  test("categoryUrl builds an allowed category path", () => {
    expect(categoryUrl("testing")).toBe("https://czyjesteldorado.pl/praca/kategoria/testing")
  })

  test("parseCategories splits, lowercases and validates", () => {
    const r = parseCategories("Testing, devops , cloud-engineering")
    expect(r.categories).toEqual(["testing", "devops", "cloud-engineering"])
    expect(r.invalid).toEqual([])
  })

  test("parseCategories reports unknown slugs instead of silently dropping them", () => {
    const r = parseCategories("testing,qa-wizard")
    expect(r.categories).toEqual(["testing"])
    expect(r.invalid).toEqual(["qa-wizard"])
  })

  test("the bridge-role categories this profile targets all exist", () => {
    for (const c of ["testing", "devops", "cloud-engineering", "support", "helpdesk", "security"]) {
      expect(CATEGORIES).toContain(c)
    }
  })
})

describe("normalizeId", () => {
  test("accepts the composite id, a path, and a full URL", () => {
    expect(normalizeId("398090-tester-automatyzujacy-itfs")).toBe(
      "398090-tester-automatyzujacy-itfs",
    )
    expect(normalizeId("/praca/398090-tester-automatyzujacy-itfs")).toBe(
      "398090-tester-automatyzujacy-itfs",
    )
    expect(
      normalizeId("https://czyjesteldorado.pl/praca/398090-tester-automatyzujacy-itfs"),
    ).toBe("398090-tester-automatyzujacy-itfs")
  })

  test("rejects a bare numeric id, which cannot build a detail path", () => {
    expect(normalizeId("398090")).toBeNull()
  })

  test("rejects a /redirect/ link, which robots.txt disallows", () => {
    expect(normalizeId("https://czyjesteldorado.pl/redirect/1CdWGCYPmbTxRW5ktkGeBu")).toBeNull()
  })
})

describe("type shape", () => {
  test("a card exposes every contract field", () => {
    const c: JobCard = parseJobs(`[${jobJson()}]`)[0]
    for (const key of ["id", "title", "company", "location", "date", "url"]) {
      expect(Object.keys(c)).toContain(key)
    }
  })
})
