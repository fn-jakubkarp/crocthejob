import { DETAIL_BASE, htmlFetch, parseJobDetail, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/**
 * Accept `<numericId>-<slug>` (what `search` emits as `id`) or a full /praca/ URL.
 *
 * A bare numeric id is rejected on purpose: the detail path needs the slug too, and there is
 * no allowed endpoint that resolves an id to a slug. Guessing would 404.
 */
export function normalizeId(input: string): string | null {
  const trimmed = input.trim()
  const fromUrl = trimmed.match(/czyjesteldorado\.pl\/praca\/(\d+-[a-z0-9-]+)/i)
  if (fromUrl) return fromUrl[1]
  const fromPath = trimmed.match(/^\/?praca\/(\d+-[a-z0-9-]+)$/i)
  if (fromPath) return fromPath[1]
  if (/^\d+-[a-z0-9-]+$/i.test(trimmed)) return trimmed
  return null
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(
      `Could not parse an id from "${opts.id}". Expected "<numericId>-<slug>" as returned by search (e.g. "398090-tester-automatyzujacy-itfs") or a full /praca/ URL. A bare numeric id is not enough — the slug is part of the path and cannot be looked up on an allowed endpoint.`,
      "BAD_ID",
    )
    return 1
  }
  try {
    const html = await htmlFetch(`${DETAIL_BASE}/${id}`)
    if (!html) {
      writeError("Posting not found (it may have expired or been removed)", "NOT_FOUND")
      return 1
    }
    const job = parseJobDetail(html, id)
    if (!job) {
      writeError(
        "Posting page carried no matching job object — markup may have changed (see url-reference.md)",
        "PARSE_FAILED",
      )
      return 1
    }

    if (opts.format === "plain") {
      const s = job.salary
      const n = job.normalizedMonthlyPln
      const salaryLine = s
        ? `Salary: ${s.from ?? "?"}-${s.to ?? "?"} ${s.currency ?? ""}/${s.unit ?? "?"}` +
          `${s.type ? ` (${s.type})` : ""}${s.isEstimated ? " [estimated by portal]" : ""}`
        : ""
      const normalizedLine =
        n && (n.min !== null || n.max !== null)
          ? `Normalized: ${n.min ?? "?"}-${n.max ?? "?"} PLN/month`
          : ""
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        salaryLine,
        normalizedLine,
        job.seniority ? `Seniority: ${job.seniority}` : "",
        job.workModes ? `Work mode: ${job.workModes.join(", ")}` : "",
        job.contractTypes ? `Contract: ${job.contractTypes.join(", ")}` : "",
        job.workloadTypes ? `Workload: ${job.workloadTypes.join(", ")}` : "",
        job.keywords ? `Keywords: ${job.keywords.join(", ")}` : "",
        job.companySize ? `Company size: ${job.companySize}` : "",
        job.source ? `Source: ${job.source}` : "",
        job.date ? `Posted: ${job.date}` : "",
        job.isExpired ? "STATUS: EXPIRED" : "",
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
