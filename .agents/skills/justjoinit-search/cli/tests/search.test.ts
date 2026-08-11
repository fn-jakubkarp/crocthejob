import { describe, expect, test } from "bun:test"
import { runCLI, parseJSON } from "./helpers.js"

// Live smoke tests. They hit justjoin.it's public pages, so they need network access
// and can fail if the portal is unreachable or changes its markup. Keep the request
// count low — that is the whole point of `--limit`.

interface SearchResponse {
  meta: { count: number; page: number; totalMatching: number | null }
  results: {
    id: string
    title: string
    company: string | null
    location: string | null
    date: string | null
    url: string
  }[]
}

describe("live search", () => {
  test("returns real results with the contract fields populated", async () => {
    const r = await runCLI(["search", "-q", "QA", "--limit", "5"])
    const body = parseJSON<SearchResponse>(r)
    expect(body.results.length).toBeGreaterThan(0)
    expect(body.results.length).toBeLessThanOrEqual(5)
    for (const job of body.results) {
      expect(job.id).toBeTruthy()
      expect(job.title).toBeTruthy()
      expect(job.url).toStartWith("https://justjoin.it/job-offer/")
      expect(Object.keys(job)).toContain("company")
      expect(Object.keys(job)).toContain("location")
      expect(Object.keys(job)).toContain("date")
    }
  }, 60000)

  test("detail returns a readable description for a live offer", async () => {
    const list = parseJSON<SearchResponse>(await runCLI(["search", "-q", "QA", "--limit", "1"]))
    const id = list.results[0]?.id
    expect(id).toBeTruthy()

    const detail = parseJSON<{ id: string; description: string | null; title: string }>(
      await runCLI(["detail", id!]),
    )
    expect(detail.id).toBe(id)
    expect(detail.title).toBeTruthy()
    expect(detail.description).toBeTruthy()
    // Description must be flattened text, not raw markup.
    expect(detail.description).not.toContain("<p>")
    expect(detail.description).not.toContain("&amp;")
  }, 60000)
})
