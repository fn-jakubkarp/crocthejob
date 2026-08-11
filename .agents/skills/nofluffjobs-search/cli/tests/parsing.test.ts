import { describe, expect, test } from "bun:test"
import {
  parseJobCards,
  parseSalaryText,
  parseLdJobPosting,
  parseDetailLocation,
  parseJobDetail,
  htmlToText,
  decodeHtmlEntities,
  citySlug,
} from "../src/helpers.js"
import { buildUrl } from "../src/commands/search.js"
import { normalizeSlug } from "../src/commands/detail.js"

/** A listing card shaped like the portal's real SSR output. */
function card(opts: {
  slug: string
  title: string
  company?: string
  city?: string
  salary?: string
  tags?: string[]
  isNew?: boolean
}): string {
  const badge = opts.isNew
    ? `<span data-cy="sup" class="title-badge title-badge--new ng-star-inserted"> NOWA </span>`
    : ""
  const tags = (opts.tags ?? [])
    .map(
      (t) =>
        `<span data-cy="category name on the job offer listing" class="posting-tag"> ${t}\n</span>`,
    )
    .join("")
  return `<a nfj-postings-item="" class="posting-list-item" href="/pl/job/${opts.slug}">
    <nfj-posting-item-title><header>
      <h3 data-cy="title position on the job offer listing" class="posting-title__position"> ${opts.title} ${badge}<!----></h3>
    </header></nfj-posting-item-title>
    ${opts.salary ? `<nfj-posting-item-salary><span data-cy="salary ranges on the job offer listing" class="posting-tag"> ${opts.salary} </span></nfj-posting-item-salary>` : ""}
    <nfj-posting-item-tiles>${tags}</nfj-posting-item-tiles>
    <footer>
      <h4 class="company-name tw-mb-0"><inline-icon commonicon="job_offer"><svg class="inline-svg"><use href="#common-job_offer"></use></svg></inline-icon> ${opts.company ?? "Some Co"} </h4>
      <nfj-posting-item-city data-cy="location on the job offer listing" class="posting-info__location"><inline-icon maticon="location_on_outline"><svg class="inline-svg"></svg></inline-icon><div><span class="tw-text-ellipsis">${opts.city ?? "Kraków"}</span></div></nfj-posting-item-city>
    </footer>
  </a>`
}

describe("parseJobCards", () => {
  test("maps a card to the portal-skill result contract", () => {
    const html = card({
      slug: "senior-qa-specialist-angry-nerds-remote",
      title: "Senior QA Specialist",
      company: "Angry Nerds",
      city: "Kraków",
      salary: "11&nbsp;760 – 16&nbsp;800  PLN",
      tags: ["Testing", "QA", "Manual Testing"],
    })
    const cards = parseJobCards(html)
    expect(cards).toHaveLength(1)
    const c = cards[0]
    expect(c.id).toBe("senior-qa-specialist-angry-nerds-remote")
    expect(c.title).toBe("Senior QA Specialist")
    expect(c.company).toBe("Angry Nerds")
    expect(c.location).toBe("Kraków")
    expect(c.url).toBe(
      "https://nofluffjobs.com/pl/job/senior-qa-specialist-angry-nerds-remote",
    )
    expect(c.tags).toEqual(["Testing", "QA", "Manual Testing"])
    // Listing cards carry no date at all — the contract requires null, not omission.
    expect(c.date).toBeNull()
  })

  test("strips the NOWA badge out of the title and reports it as a flag", () => {
    const c = parseJobCards(
      card({ slug: "qa-engineer-mindbox-krakow", title: "QA Engineer", isNew: true }),
    )[0]
    expect(c.title).toBe("QA Engineer")
    expect(c.isNew).toBe(true)
  })

  test("marks postings without the badge as not new", () => {
    const c = parseJobCards(card({ slug: "qa-engineer-old-krakow", title: "QA Engineer" }))[0]
    expect(c.isNew).toBe(false)
  })

  test("parses several cards and deduplicates repeats", () => {
    const html =
      card({ slug: "a-qa-krakow", title: "A" }) +
      card({ slug: "b-qa-krakow", title: "B" }) +
      card({ slug: "a-qa-krakow", title: "A" })
    expect(parseJobCards(html).map((c) => c.id)).toEqual(["a-qa-krakow", "b-qa-krakow"])
  })

  test("one malformed card does not break the others", () => {
    const broken = `<a nfj-postings-item="" href="/pl/job/broken-card-krakow"><h3>no data-cy here</h3></a>`
    const html = broken + card({ slug: "good-qa-krakow", title: "Good" })
    expect(parseJobCards(html).map((c) => c.id)).toEqual(["good-qa-krakow"])
  })

  test("a card without a salary yields null rather than a guess", () => {
    const c = parseJobCards(card({ slug: "no-pay-krakow", title: "T" }))[0]
    expect(c.salary).toBeNull()
  })

  test("returns an empty array when nothing matches", () => {
    expect(parseJobCards("<html><body>no cards</body></html>")).toEqual([])
  })
})

describe("parseSalaryText", () => {
  test("parses a range with non-breaking-space separators", () => {
    expect(parseSalaryText("11&nbsp;760 – 16&nbsp;800  PLN")).toEqual({
      from: 11760,
      to: 16800,
      currency: "PLN",
      unit: "month",
    })
  })

  test("parses a single figure", () => {
    expect(parseSalaryText("16 800 PLN")).toEqual({
      from: 16800,
      to: null,
      currency: "PLN",
      unit: "month",
    })
  })

  test("handles a hyphen range and a non-PLN currency", () => {
    expect(parseSalaryText("4 000-5 500 EUR")).toEqual({
      from: 4000,
      to: 5500,
      currency: "EUR",
      unit: "month",
    })
  })

  test("detects an hourly rate", () => {
    expect(parseSalaryText("90 – 120 PLN/godz.")?.unit).toBe("hour")
  })

  test("returns null when there is no figure", () => {
    expect(parseSalaryText("Undisclosed")).toBeNull()
    expect(parseSalaryText("   ")).toBeNull()
  })

  test("ignores digits inside Angular component-id attributes", () => {
    // Regression: reading the raw markup produced a 4,252,321,822 PLN "salary" from
    // `_nghost-serverapp-c4252321822` on cards that publish no figure.
    const raw = `<span _nghost-serverapp-c4252321822="" class="posting-tag ng-star-inserted"><!----></span>`
    expect(parseSalaryText(raw)).toBeNull()
  })

  test("still reads a figure when the number sits in a nested element", () => {
    const raw = `<span _nghost-serverapp-c4252321822=""><span> 12&nbsp;000 – 15&nbsp;000 </span> PLN </span>`
    expect(parseSalaryText(raw)).toEqual({
      from: 12000,
      to: 15000,
      currency: "PLN",
      unit: "month",
    })
  })
})

describe("decodeHtmlEntities", () => {
  test("decodes named, numeric and hex entities plus nbsp", () => {
    expect(decodeHtmlEntities("A&amp;B &#324; &#x2014;&nbsp;end")).toBe("A&B ń — end")
  })
})

describe("htmlToText", () => {
  test("keeps bullets and paragraph breaks", () => {
    const out = htmlToText("<p>Zakres:</p><ul><li>Playwright</li><li>API</li></ul>")
    expect(out).toContain("Zakres:")
    expect(out).toContain("- Playwright")
    expect(out).toContain("- API")
  })
})

describe("parseDetailLocation", () => {
  test("reads an office address", () => {
    const html = `<span data-cy="location_pin"><span > Wrocław, Legnicka 16 </span><span></span></span>`
    expect(parseDetailLocation(html)).toBe("Wrocław, Legnicka 16")
  })

  test("falls back to the remote label", () => {
    const html = `<div data-cy="location_remote"> Praca zdalna <inline-icon></inline-icon></div>`
    expect(parseDetailLocation(html)).toBe("Praca zdalna")
  })

  test("returns null when neither is present", () => {
    expect(parseDetailLocation("<div>nothing</div>")).toBeNull()
  })
})

describe("parseLdJobPosting / parseJobDetail", () => {
  const html = `<html><head>
    <script type="application/ld+json">{"@graph":[{"@type":"Organization","name":"NFJ"}]}</script>
    <script type="application/ld+json">{"@type":"JobPosting","title":"Senior QA Specialist ",
      "datePosted":"2026-07-14","employmentType":"CONTRACTOR","jobLocation":null,
      "hiringOrganization":{"@type":"Organization","name":"Angry Nerds"},
      "baseSalary":{"@type":"MonetaryAmount","currency":"PLN","value":{"value":16800,"unitText":"Month"}},
      "description":"<p>Hej!</p><ul><li>Playwright</li></ul>"}</script>
  </head><body><span data-cy="location_pin"><span > Wrocław, Legnicka 16 </span></span></body></html>`

  test("finds the JobPosting inside an @graph-mixed document", () => {
    expect(parseLdJobPosting(html)?.title).toBe("Senior QA Specialist ")
  })

  test("builds a detail record and recovers the null jobLocation from the page", () => {
    const d = parseJobDetail(html, "senior-qa-specialist-angry-nerds-remote")!
    expect(d.title).toBe("Senior QA Specialist")
    expect(d.company).toBe("Angry Nerds")
    expect(d.location).toBe("Wrocław, Legnicka 16")
    expect(d.date).toBe("2026-07-14")
    expect(d.employmentType).toBe("CONTRACTOR")
    expect(d.salary).toEqual({ from: 16800, to: null, currency: "PLN", unit: "month" })
    expect(d.description).toContain("- Playwright")
  })

  test("returns null when the page has no JobPosting block", () => {
    expect(parseJobDetail("<html></html>", "x-y")).toBeNull()
  })
})

describe("citySlug", () => {
  test("maps English and Polish spellings", () => {
    expect(citySlug("Cracow")).toBe("krakow")
    expect(citySlug("Kraków")).toBe("krakow")
    expect(citySlug("Warsaw")).toBe("warszawa")
    expect(citySlug("Wrocław")).toBe("wroclaw")
  })

  test("maps remote to the portal's own remote segment", () => {
    expect(citySlug("remote")).toBe("praca-zdalna")
    expect(citySlug("zdalnie")).toBe("praca-zdalna")
  })

  test("returns null for no input", () => {
    expect(citySlug(undefined)).toBeNull()
    expect(citySlug("  ")).toBeNull()
  })
})

describe("buildUrl", () => {
  const base = { jobage: 9999, page: 1, format: "json" } as const

  test("puts the keyword in the path, not a query parameter", () => {
    expect(buildUrl({ ...base, query: "qa" })).toBe("https://nofluffjobs.com/pl/qa")
    expect(buildUrl({ ...base, query: "qa automation" })).toBe(
      "https://nofluffjobs.com/pl/qa%20automation",
    )
  })

  test("appends the city after the keyword", () => {
    expect(buildUrl({ ...base, query: "qa", location: "Cracow" })).toBe(
      "https://nofluffjobs.com/pl/qa/krakow",
    )
  })

  test("uses the portal's catch-all keyword when only a city is given", () => {
    // A bare city would be read as the keyword, which returns the wrong page.
    expect(buildUrl({ ...base, location: "krakow" })).toBe(
      "https://nofluffjobs.com/pl/praca-it/krakow",
    )
  })

  test("only sends page past the first", () => {
    expect(buildUrl({ ...base, query: "qa", page: 3 })).toBe(
      "https://nofluffjobs.com/pl/qa?page=3",
    )
    expect(buildUrl({ ...base, query: "qa", page: 1 })).not.toContain("page=")
  })
})

describe("normalizeSlug", () => {
  test("accepts a bare slug, a path, and a full URL", () => {
    expect(normalizeSlug("senior-qa-specialist-angry-nerds-remote")).toBe(
      "senior-qa-specialist-angry-nerds-remote",
    )
    expect(normalizeSlug("/pl/job/qa-engineer-mindbox-krakow")).toBe(
      "qa-engineer-mindbox-krakow",
    )
    expect(normalizeSlug("https://nofluffjobs.com/pl/job/qa-engineer-mindbox-krakow")).toBe(
      "qa-engineer-mindbox-krakow",
    )
  })

  test("rejects input with no slug", () => {
    expect(normalizeSlug("1234")).toBeNull()
    expect(normalizeSlug("")).toBeNull()
  })
})
