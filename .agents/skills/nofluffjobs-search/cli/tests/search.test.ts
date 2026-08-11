import { describe, expect, test } from "bun:test"
import { runCLI, parseJSON } from "./helpers.js"

// Live smoke tests against nofluffjobs.com's public pages. They need network access and
// can fail if the portal is unreachable or changes its markup. Request count is kept low
// deliberately.

interface SearchResponse {
  meta: { count: number; page: number; renderedTotal: number }
  results: {
    id: string
    title: string
    company: string | null
    location: string | null
    date: string | null
    url: string
    salary: { from: number | null; currency: string | null } | null
  }[]
}

describe("live search", () => {
  test("returns real results with contract fields populated", async () => {
    const body = parseJSON<SearchResponse>(
      await runCLI(["search", "-q", "qa", "-l", "cracow", "--limit", "5"]),
    )
    expect(body.results.length).toBeGreaterThan(0)
    expect(body.results.length).toBeLessThanOrEqual(5)
    for (const job of body.results) {
      expect(job.id).toBeTruthy()
      expect(job.title).toBeTruthy()
      expect(job.url).toStartWith("https://nofluffjobs.com/pl/job/")
      expect(Object.keys(job)).toContain("company")
      expect(Object.keys(job)).toContain("location")
      expect(Object.keys(job)).toContain("date")
      // Titles must not carry the portal's "NOWA" badge text.
      expect(job.title).not.toMatch(/\bNOWA\b/)
    }
  }, 60000)

  test("salary is published on this portal, so most results carry one", async () => {
    const body = parseJSON<SearchResponse>(
      await runCLI(["search", "-q", "qa", "--limit", "10"]),
    )
    const withSalary = body.results.filter((r) => r.salary && r.salary.from !== null)
    expect(withSalary.length).toBeGreaterThan(0)
    for (const r of withSalary) expect(r.salary!.currency).toBeTruthy()
  }, 60000)

  test("detail supplies the date and description that listing cards lack", async () => {
    const list = parseJSON<SearchResponse>(
      await runCLI(["search", "-q", "qa", "-l", "cracow", "--limit", "1"]),
    )
    const id = list.results[0]?.id
    expect(id).toBeTruthy()
    expect(list.results[0].date).toBeNull()

    const detail = parseJSON<{
      id: string
      title: string
      date: string | null
      description: string | null
    }>(await runCLI(["detail", id!]))
    expect(detail.id).toBe(id)
    expect(detail.title).toBeTruthy()
    expect(detail.date).toBeTruthy()
    expect(detail.description).toBeTruthy()
    expect(detail.description).not.toContain("<p>")
  }, 60000)
})
