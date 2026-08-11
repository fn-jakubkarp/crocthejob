#!/usr/bin/env bun
// Self-contained CLI for searching IT jobs on No Fluff Jobs (nofluffjobs.com), where
// every posting publishes a salary range. No external CLI framework and zero runtime
// dependencies, so it runs anywhere `bun` is available.
//
// Personal use only. This reads only nofluffjobs.com paths that robots.txt allows — the
// server-rendered listing pages and /pl/job/<slug> detail pages. It never calls /api/ or
// any /posting/ path, both of which are disallowed. Automated access may still conflict
// with the portal's terms, so keep volume low and run it on your own responsibility.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", l: "location", n: "limit" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--") || a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const HELP = `nofluffjobs-cli — search IT jobs on No Fluff Jobs (Poland, salary always published)

USAGE
  bun run src/cli.ts search [flags]
  bun run src/cli.ts detail <slug|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keyword (role, technology). Becomes a path segment, which is
                          how this portal filters server-side. Recommended.
  --location, -l <city>   City or "remote". Accepts "Cracow"/"Krakow"/"Kraków",
                          "Warszawa", "Wroclaw", "zdalnie", etc.
  --page <n>              1-indexed, 20 results per page. Default 1.
  --limit, -n <n>         Cap results emitted (client-side).
  --format <fmt>          json (default) | table | plain.
  --jobage <days>         NOT SUPPORTED — listing cards carry no date. Exits 1 if passed.

EXAMPLES
  bun run src/cli.ts search -q qa -l cracow --format table
  bun run src/cli.ts search -q "qa automation" --format table
  bun run src/cli.ts search -q devops -l remote --limit 10 --format table
  bun run src/cli.ts search -q kubernetes --page 2 --format table
  bun run src/cli.ts detail senior-qa-specialist-angry-nerds-remote --format plain

Personal use only — reads allowed public pages, never /api/ or /posting/. Keep volume low.
`

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  if (cmd === "search") {
    const fmt = (flags.format as string) || "json"

    const parseIntFlag = (name: string, raw: string | boolean | string[]): number | null => {
      const val = parseInt(raw as string, 10)
      if (isNaN(val)) {
        process.stderr.write(
          JSON.stringify({ error: `--${name} must be a number, got "${raw}"`, code: "BAD_ARG" }) +
            "\n",
        )
        return null
      }
      return val
    }

    for (const name of ["jobage", "page", "limit"]) {
      if (flags[name] !== undefined) {
        const v = parseIntFlag(name, flags[name])
        if (v === null) return 1
        flags[name] = String(v)
      }
    }

    const opts: SearchOpts = {
      query: typeof flags.query === "string" ? flags.query : undefined,
      location: typeof flags.location === "string" ? flags.location : undefined,
      jobage: flags.jobage ? parseInt(flags.jobage as string, 10) : 9999,
      page: flags.page ? Math.max(1, parseInt(flags.page as string, 10)) : 1,
      limit: flags.limit ? parseInt(flags.limit as string, 10) : undefined,
      format: (["json", "table", "plain"].includes(fmt) ? fmt : "json") as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) {
      process.stderr.write(
        JSON.stringify({ error: "detail requires an <slug|url>", code: "NO_ID" }) + "\n",
      )
      return 1
    }
    const fmt = (flags.format as string) || "json"
    const opts: DetailOpts = {
      id,
      format: (fmt === "plain" ? "plain" : "json") as DetailOpts["format"],
    }
    return runDetail(opts)
  }

  process.stderr.write(
    JSON.stringify({ error: `Unknown command "${cmd}"`, code: "BAD_CMD" }) + "\n",
  )
  return 1
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    process.stderr.write(
      JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
        code: "INTERNAL_ERROR",
      }) + "\n",
    )
    process.exit(1)
  })
