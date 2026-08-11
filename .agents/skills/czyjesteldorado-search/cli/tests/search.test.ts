import { describe, expect, test } from "bun:test"
import { runCLI, parseJSON } from "./helpers.js"

// Live smoke tests against czyjesteldorado.pl's public category pages. They need network
// access and can fail if the portal is unreachable or changes its markup. One category per
// test keeps the request count to one.

interface SearchResponse {
  meta: {
    count: number
    page: number
    matched: number
    renderedPerCategory: number
    categories: { category: string; rendered: number; resultsCount: number | null }[]
    coverage: string
  }
  results: {
    id: string
    numericId: number | null
    title: string
    company: string | null
    location: string | null
    date: string | null
    url: string
    source: string | null
    normalizedMonthlyPln: { min: number | null; max: number | null } | null
  }[]
}

describe("live search", () => {
  test("returns real postings with the contract fields populated", async () => {
    const body = parseJSON<SearchResponse>(
      await runCLI(["search", "-c", "testing", "--limit", "5"]),
    )
    expect(body.results.length).toBeGreaterThan(0)
    expect(body.results.length).toBeLessThanOrEqual(5)
    for (const job of body.results) {
      expect(job.id).toMatch(/^\d+-[a-z0-9-]+$/)
      expect(job.title).toBeTruthy()
      expect(job.url).toStartWith("https://czyjesteldorado.pl/praca/")
      // The portal's own url field is a robots-disallowed /redirect/ link.
      expect(job.url).not.toContain("/redirect/")
      expect(job.date).toBeTruthy()
      for (const key of ["company", "location", "source"]) {
        expect(Object.keys(job)).toContain(key)
      }
    }
  }, 60000)

  test("meta states the coverage gap rather than implying completeness", async () => {
    const body = parseJSON<SearchResponse>(
      await runCLI(["search", "-c", "testing", "--limit", "3"]),
    )
    expect(body.meta.renderedPerCategory).toBe(10)
    expect(body.meta.coverage).toContain("newest")
    const cat = body.meta.categories[0]
    expect(cat.category).toBe("testing")
    // The portal holds far more than it renders; that total must be reported.
    expect(cat.resultsCount).toBeGreaterThan(cat.rendered)
  }, 60000)

  test("salary normalization makes hourly and monthly rates comparable", async () => {
    const body = parseJSON<SearchResponse>(await runCLI(["search", "-c", "testing"]))
    const withPay = body.results.filter(
      (r) => r.normalizedMonthlyPln && r.normalizedMonthlyPln.min !== null,
    )
    expect(withPay.length).toBeGreaterThan(0)
    for (const r of withPay) {
      // Monthly PLN figures for Polish IT sit far above an hourly number; this catches a
      // regression where an hourly rate is emitted unnormalized.
      expect(r.normalizedMonthlyPln!.min!).toBeGreaterThan(1000)
    }
  }, 60000)

  test("detail returns the structured description for a live posting", async () => {
    const list = parseJSON<SearchResponse>(
      await runCLI(["search", "-c", "testing", "--limit", "1"]),
    )
    const id = list.results[0]?.id
    expect(id).toBeTruthy()

    const detail = parseJSON<{
      id: string
      title: string
      description: string | null
      descriptionSections: Record<string, string> | null
    }>(await runCLI(["detail", id!]))
    expect(detail.id).toBe(id)
    expect(detail.title).toBeTruthy()
    expect(detail.description).toBeTruthy()
    expect(detail.descriptionSections).toBeTruthy()
    expect(detail.description).not.toContain("<p>")
  }, 60000)
})
