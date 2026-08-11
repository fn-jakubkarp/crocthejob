import { describe, expect, test } from "bun:test"
import {
  extractRscPayload,
  sliceJsonObject,
  parseOffers,
  parseTotalItems,
  parseLdJobPosting,
  parseDetailOffer,
  htmlToText,
  reflowRunOnText,
  filterByAge,
  locationSlug,
} from "../src/helpers.js"
import { buildUrl } from "../src/commands/search.js"
import { normalizeSlug } from "../src/commands/detail.js"

/** A minimal offer object shaped exactly like justjoin.it's own serialization. */
function offerJson(over: Record<string, unknown> = {}): string {
  const base = {
    applyUrl: null,
    body: "QA Test Engineer",
    city: "Gdańsk",
    companyName: "Jit Team",
    employmentTypes: [
      {
        from: 7600,
        to: 16800,
        currency: "PLN",
        currencySource: "original",
        type: "b2b",
        unit: "month",
        gross: false,
      },
      {
        from: 1998,
        to: 4418,
        currency: "USD",
        currencySource: "conversion",
        type: "b2b",
        unit: "month",
        gross: false,
      },
    ],
    experienceLevel: "mid",
    multilocation: [{ city: "Gdańsk" }, { city: "Kraków" }],
    publishedAt: "2026-07-29T11:38:23.44965Z",
    requiredSkills: ["Playwright", "TypeScript"],
    slug: "jit-team-qa-test-engineer-gdansk-testing-c5a26c49",
    title: "QA Test Engineer",
    workplaceType: "hybrid",
    ...over,
  }
  // Keys must be emitted with applyUrl first, matching the real payload.
  return JSON.stringify(base)
}

/** Wrap payload text into the RSC push calls a real page emits, split across chunks. */
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
  test("rejoins chunks that split a single offer object", () => {
    const payload = `{"meta":{"totalItems":705},"data":[${offerJson()}]}`
    const html = rscHtml(payload, 17)
    expect(extractRscPayload(html)).toBe(payload)
  })

  test("returns empty string when no payload is present", () => {
    expect(extractRscPayload("<html><body>nothing here</body></html>")).toBe("")
  })

  test("skips a malformed chunk instead of throwing", () => {
    const html =
      `<script>self.__next_f.push([1,"good "])</script>` +
      `<script>self.__next_f.push([1,"tail"])</script>`
    expect(extractRscPayload(html)).toBe("good tail")
  })
})

describe("sliceJsonObject", () => {
  test("ignores braces inside string values", () => {
    const text = `prefix{"a":"} not the end {","b":1}suffix`
    const sliced = sliceJsonObject(text, text.indexOf("{"))
    expect(sliced).toBe(`{"a":"} not the end {","b":1}`)
    expect(JSON.parse(sliced!)).toEqual({ a: "} not the end {", b: 1 })
  })

  test("handles escaped quotes", () => {
    const text = `{"a":"say \\"hi\\"","b":2}`
    expect(JSON.parse(sliceJsonObject(text, 0)!)).toEqual({ a: 'say "hi"', b: 2 })
  })

  test("returns null on an unterminated object", () => {
    expect(sliceJsonObject(`{"a":1`, 0)).toBeNull()
  })

  test("returns null when the index is not an opening brace", () => {
    expect(sliceJsonObject(`x{"a":1}`, 0)).toBeNull()
  })
})

describe("parseOffers", () => {
  test("maps an offer to the portal-skill result contract", () => {
    const cards = parseOffers(`"data":[${offerJson()}]`)
    expect(cards).toHaveLength(1)
    const c = cards[0]
    expect(c.id).toBe("jit-team-qa-test-engineer-gdansk-testing-c5a26c49")
    expect(c.title).toBe("QA Test Engineer")
    expect(c.company).toBe("Jit Team")
    expect(c.location).toBe("Gdańsk")
    expect(c.date).toBe("2026-07-29T11:38:23.44965Z")
    expect(c.url).toBe(
      "https://justjoin.it/job-offer/jit-team-qa-test-engineer-gdansk-testing-c5a26c49",
    )
    expect(c.experienceLevel).toBe("mid")
    expect(c.workplaceType).toBe("hybrid")
    expect(c.remote).toBe(false)
    expect(c.skills).toEqual(["Playwright", "TypeScript"])
  })

  test("exposes every city a multi-location offer is open in", () => {
    // A search for Kraków legitimately returns this offer even though its primary
    // city is Gdańsk, so the full city list has to be visible to the caller.
    const c = parseOffers(`[${offerJson()}]`)[0]
    expect(c.location).toBe("Gdańsk")
    expect(c.locations).toEqual(["Gdańsk", "Kraków"])
  })

  test("picks the employer's original currency, not a conversion", () => {
    const c = parseOffers(`[${offerJson()}]`)[0]
    expect(c.salary).toEqual({
      type: "b2b",
      from: 7600,
      to: 16800,
      currency: "PLN",
      unit: "month",
      gross: false,
    })
  })

  test("discards objects that carry applyUrl but are not offers", () => {
    const notAnOffer = `{"applyUrl":"/x","label":"Apply","value":1}`
    const cards = parseOffers(`[${notAnOffer},${offerJson()}]`)
    expect(cards).toHaveLength(1)
    expect(cards[0].company).toBe("Jit Team")
  })

  test("deduplicates repeated slugs", () => {
    const cards = parseOffers(`[${offerJson()},${offerJson()}]`)
    expect(cards).toHaveLength(1)
  })

  test("one malformed offer does not break the rest", () => {
    const broken = `{"applyUrl":null,"slug":"a-b","title":"T","companyName":`
    const cards = parseOffers(`[${broken},${offerJson()}]`)
    expect(cards).toHaveLength(1)
  })

  test("missing optional values become null, never omitted", () => {
    const c = parseOffers(
      `[${offerJson({ city: null, publishedAt: null, employmentTypes: [], requiredSkills: [], experienceLevel: null, workplaceType: null, multilocation: [] })}]`,
    )[0]
    expect(c.location).toBeNull()
    expect(c.locations).toBeNull()
    expect(c.date).toBeNull()
    expect(c.salary).toBeNull()
    expect(c.skills).toBeNull()
    expect(c.experienceLevel).toBeNull()
    expect(c.remote).toBeNull()
  })
})

describe("parseTotalItems", () => {
  test("reads the pagination total", () => {
    expect(parseTotalItems(`{"meta":{"from":0,"totalItems":705}}`)).toBe(705)
  })
  test("returns null when absent", () => {
    expect(parseTotalItems("{}")).toBeNull()
  })
})

describe("parseLdJobPosting", () => {
  const html = `<html><head>
    <script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[]}</script>
    <script type="application/ld+json">{"@type":"JobPosting","title":"QA Test Engineer","datePosted":"2026-07-29"}</script>
  </head></html>`

  test("finds the JobPosting node past other blocks", () => {
    const ld = parseLdJobPosting(html)
    expect(ld?.title).toBe("QA Test Engineer")
  })

  test("returns null when there is no JobPosting", () => {
    expect(parseLdJobPosting(`<script type="application/ld+json">{"@type":"Thing"}</script>`)).toBeNull()
  })

  test("survives an unparsable block", () => {
    const broken =
      `<script type="application/ld+json">{not json}</script>` +
      `<script type="application/ld+json">{"@type":"JobPosting","title":"Ok"}</script>`
    expect(parseLdJobPosting(broken)?.title).toBe("Ok")
  })
})

describe("htmlToText", () => {
  test("preserves block breaks, bullets and decodes entities", () => {
    const out = htmlToText("<p>Role &amp; scope</p><ul><li>Playwright</li><li>CI/CD</li></ul>")
    expect(out).toContain("Role & scope")
    expect(out).toContain("- Playwright")
    expect(out).toContain("- CI/CD")
  })

  test("decodes numeric and hex entities", () => {
    expect(htmlToText("Gda&#324;sk &#x2014; hybrid")).toBe("Gdańsk — hybrid")
  })
})

describe("reflowRunOnText", () => {
  test("breaks fused sentences without altering words", () => {
    const out = reflowRunOnText("We ship fast.Our team is small.")
    expect(out).toBe("We ship fast.\nOur team is small.")
    expect(out.replace(/\n/g, "")).toBe("We ship fast.Our team is small.")
  })

  test("leaves text that already has line breaks alone", () => {
    const src = "Line one.\nLine two.Still line two"
    expect(reflowRunOnText(src)).toBe(src)
  })

  test("handles Polish capitals", () => {
    expect(reflowRunOnText("Koniec.Świetnie")).toBe("Koniec.\nŚwietnie")
  })
})

describe("parseDetailOffer", () => {
  const slug = "singu-qa-engineer-krakow-testing"

  test("skips multilocation stubs and returns the real offer object", () => {
    const stub = `{"slug":"${slug}","title":"x","city":"Kraków"}`
    const real = `{"slug":"${slug}","title":"QA Engineer","companyName":"SINGU","experienceLevel":{"label":"mid","value":"mid"}}`
    const found = parseDetailOffer(`[${stub},${real}]`, slug)
    expect(found?.companyName).toBe("SINGU")
  })

  test("returns null when the slug is absent", () => {
    expect(parseDetailOffer(`{"slug":"other","title":"t","companyName":"C"}`, slug)).toBeNull()
  })
})

describe("filterByAge", () => {
  const fresh = { date: new Date().toISOString() } as never
  const old = { date: "2020-01-01T00:00:00Z" } as never

  test("drops offers older than the cutoff", () => {
    expect(filterByAge([fresh, old], 7)).toEqual([fresh])
  })

  test("keeps everything when no age is set", () => {
    expect(filterByAge([fresh, old], 9999)).toHaveLength(2)
  })

  test("keeps offers with an unparsable or missing date", () => {
    const undated = { date: null } as never
    expect(filterByAge([undated], 1)).toHaveLength(1)
  })
})

describe("locationSlug", () => {
  test("defaults to all-locations", () => {
    expect(locationSlug(undefined)).toBe("all-locations")
    expect(locationSlug("")).toBe("all-locations")
  })

  test("maps English and Polish city names to portal slugs", () => {
    expect(locationSlug("Cracow")).toBe("krakow")
    expect(locationSlug("Kraków")).toBe("krakow")
    expect(locationSlug("Warsaw")).toBe("warszawa")
    expect(locationSlug("Wrocław")).toBe("wroclaw")
    expect(locationSlug("zdalnie")).toBe("remote")
  })

  test("slugifies an unmapped city", () => {
    expect(locationSlug("Zielona Góra")).toBe("zielona-gora")
  })
})

describe("buildUrl", () => {
  const base = { jobage: 9999, page: 1, format: "json" } as const

  test("defaults to all-locations with no params", () => {
    expect(buildUrl({ ...base })).toBe("https://justjoin.it/job-offers/all-locations")
  })

  test("adds the keyword and category", () => {
    expect(buildUrl({ ...base, query: "QA engineer", category: "testing", location: "cracow" })).toBe(
      "https://justjoin.it/job-offers/krakow/testing?keyword=QA+engineer",
    )
  })

  test("never sends a page parameter — the portal ignores it", () => {
    expect(buildUrl({ ...base, page: 2 })).not.toContain("page=")
    expect(buildUrl({ ...base, page: 1 })).not.toContain("page=")
  })
})

describe("normalizeSlug", () => {
  test("accepts a bare slug", () => {
    expect(normalizeSlug("jit-team-qa-test-engineer-gdansk-testing-c5a26c49")).toBe(
      "jit-team-qa-test-engineer-gdansk-testing-c5a26c49",
    )
  })

  test("extracts a slug from a full URL", () => {
    expect(normalizeSlug("https://justjoin.it/job-offer/some-company-qa-krakow-abc123")).toBe(
      "some-company-qa-krakow-abc123",
    )
  })

  test("rejects input with no slug", () => {
    expect(normalizeSlug("12345")).toBeNull()
    expect(normalizeSlug("")).toBeNull()
  })
})
