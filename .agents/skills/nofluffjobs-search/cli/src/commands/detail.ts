import { DETAIL_BASE, htmlFetch, parseJobDetail, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/** Accept a bare slug or a full nofluffjobs.com job URL (any language prefix). */
export function normalizeSlug(input: string): string | null {
  const trimmed = input.trim()
  const fromUrl = trimmed.match(/nofluffjobs\.com\/(?:[a-z-]+\/)?job\/([a-z0-9-]+)/i)
  if (fromUrl) return fromUrl[1]
  const fromPath = trimmed.match(/^\/?(?:[a-z-]+\/)?job\/([a-z0-9-]+)$/i)
  if (fromPath) return fromPath[1]
  if (/^[a-z0-9-]{6,}$/i.test(trimmed) && trimmed.includes("-")) return trimmed
  return null
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const slug = normalizeSlug(opts.id)
  if (!slug) {
    writeError(
      `Could not parse a job slug from "${opts.id}" (expected e.g. "senior-qa-specialist-angry-nerds-remote")`,
      "BAD_ID",
    )
    return 1
  }
  try {
    const html = await htmlFetch(`${DETAIL_BASE}/${slug}`)
    if (!html) {
      writeError("Posting not found (it may have expired)", "NOT_FOUND")
      return 1
    }
    const job = parseJobDetail(html, slug)
    if (!job) {
      writeError(
        "Posting page carried no schema.org JobPosting block — markup may have changed (see url-reference.md)",
        "PARSE_FAILED",
      )
      return 1
    }

    if (opts.format === "plain") {
      const s = job.salary
      const salaryLine =
        s && (s.from !== null || s.to !== null)
          ? `Salary: ${s.from ?? "?"}${s.to !== null ? `-${s.to}` : ""} ${s.currency ?? ""} / ${s.unit ?? "?"}`
          : ""
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        salaryLine,
        job.seniority ? `Seniority: ${job.seniority}` : "",
        job.employmentType ? `Employment: ${job.employmentType}` : "",
        job.date ? `Posted: ${job.date}` : "",
        job.validThrough ? `Valid through: ${job.validThrough}` : "",
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
