#!/usr/bin/env bun
// Self-contained CLI for searching IT jobs on justjoin.it (Poland's largest IT job
// board). No external CLI framework and zero runtime dependencies, so it runs anywhere
// `bun` is available with nothing installed beyond the repo clone.
//
// Personal use only. This reads justjoin.it's public HTML pages and never the /api/
// endpoints, which the site's robots.txt disallows. Automated access may still be
// against the portal's terms, so keep volume low, do not use it commercially or for
// bulk collection, and run it on your own responsibility.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = {
    q: "query",
    l: "location",
    n: "limit",
    c: "category",
  }
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

const HELP = `justjoinit-cli — search IT jobs on justjoin.it (Poland)

USAGE
  bun run src/cli.ts search [flags]
  bun run src/cli.ts detail <slug|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keyword search (title, skill, technology). Server-side.
  --location, -l <city>   City or "remote" or "all-locations" (default). Accepts
                          "Cracow"/"Krakow"/"Kraków", "Warszawa", "Wroclaw", etc.
  --category, -c <slug>   Category path segment, e.g. testing, devops, data, frontend.
  --jobage <days>         Keep offers published within N days (client-side).
  --experience <level>    junior | mid | senior | c_level (client-side filter).
  --remote <mode>         remote | hybrid | office (client-side, on workplaceType).
  --page <n>              Only 1 is supported. justjoin.it server-renders ~100 offers per
                          query and ignores a page parameter; --page > 1 exits 1 rather
                          than silently repeating page 1. Narrow the query instead.
  --limit, -n <n>         Cap results emitted (client-side).
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "QA" -l cracow --format table
  bun run src/cli.ts search -c testing -l remote --jobage 7 --format table
  bun run src/cli.ts search -q "playwright" --experience mid --limit 10 --format table
  bun run src/cli.ts search -c devops -l krakow --experience junior --format json
  bun run src/cli.ts detail jit-team-qa-test-engineer-gdansk-testing-c5a26c49 --format plain

Personal use only — reads public pages, never /api/ (robots.txt). Keep volume low.
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
      category: typeof flags.category === "string" ? flags.category : undefined,
      jobage: flags.jobage ? parseInt(flags.jobage as string, 10) : 9999,
      experience: typeof flags.experience === "string" ? flags.experience : undefined,
      remote: typeof flags.remote === "string" ? flags.remote : undefined,
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
