import { DETAIL_BASE, htmlFetch, parseJobDetail, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/** Accept a bare slug or a full justjoin.it job-offer URL. */
export function normalizeSlug(input: string): string | null {
  const trimmed = input.trim()
  const fromUrl = trimmed.match(/justjoin\.it\/(?:job-offer|offers)\/([a-z0-9-]+)/i)
  if (fromUrl) return fromUrl[1]
  if (/^[a-z0-9-]{6,}$/i.test(trimmed) && trimmed.includes("-")) return trimmed
  return null
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const slug = normalizeSlug(opts.id)
  if (!slug) {
    writeError(
      `Could not parse an offer slug from "${opts.id}" (expected e.g. "jit-team-qa-test-engineer-gdansk-testing-c5a26c49")`,
      "BAD_ID",
    )
    return 1
  }
  try {
    const html = await htmlFetch(`${DETAIL_BASE}/${slug}`)
    if (!html) {
      writeError("Offer not found (it may have expired)", "NOT_FOUND")
      return 1
    }
    const job = parseJobDetail(html, slug)
    if (!job) {
      writeError(
        "Offer page returned no parsable job data — markup may have changed (see url-reference.md)",
        "PARSE_FAILED",
      )
      return 1
    }

    if (opts.format === "plain") {
      const s = job.salary
      const salaryLine =
        s && (s.from !== null || s.to !== null)
          ? `Salary: ${s.from ?? "?"}-${s.to ?? "?"} ${s.currency ?? ""} / ${s.unit ?? "?"}${s.type ? ` (${s.type})` : ""}`
          : ""
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        salaryLine,
        job.experienceLevel ? `Level: ${job.experienceLevel}` : "",
        job.workplaceType ? `Workplace: ${job.workplaceType}` : "",
        job.employmentType ? `Employment: ${job.employmentType}` : "",
        job.date ? `Posted: ${job.date}` : "",
        job.validThrough ? `Valid through: ${job.validThrough}` : "",
        job.skills && job.skills.length > 0 ? `Skills: ${job.skills.join(", ")}` : "",
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
      ].filter((l) => l !== "")
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
