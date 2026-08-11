#!/usr/bin/env bun
// Self-contained CLI for searching IT jobs on czyjesteldorado.pl, a Polish IT job
// aggregator that republishes postings from Pracuj.pl, No Fluff Jobs and employers with
// normalized salary, seniority, work mode and contract data. Zero runtime dependencies.
//
// Personal use only. The site's robots.txt disallows /api/ and /redirect/, so this CLI
// reads only the public category and posting pages and rebuilds detail links in the
// allowed /praca/<id>-<slug> form. Automated access may still conflict with the portal's
// terms, so keep volume low and run it on your own responsibility.

import { CATEGORIES } from "./helpers.js"
import { runSearch, parseCategories, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = {
    q: "query",
    c: "category",
    l: "city",
    n: "limit",
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

const HELP = `czyjesteldorado-cli — search IT jobs on czyjesteldorado.pl (Polish IT aggregator)

USAGE
  bun run src/cli.ts search --category <slug[,slug...]> [flags]
  bun run src/cli.ts detail <id|url> [--format json|plain]
  bun run src/cli.ts categories

SEARCH FLAGS
  --category, -c <slugs>  REQUIRED. Comma-separated category slugs. One HTTP request each.
                          Run \`categories\` to list them.
  --query, -q <text>      Keyword filter, applied CLIENT-SIDE over title, company, summary,
                          keywords and categories. The portal's own search posts to its
                          disallowed /api/, so server-side keyword search is unavailable.
  --city, -l <city>       City filter (client-side), or "remote". Accepts Polish spellings.
  --seniority <level>     e.g. junior | mid | senior (client-side).
  --remote                Only fully remote postings (client-side).
  --jobage <days>         Keep postings published within N days (client-side).
  --limit, -n <n>         Cap results emitted.
  --format <fmt>          json (default) | table | plain.
  --page <n>              Only 1 is supported; --page > 1 exits 1. See COVERAGE.

COVERAGE
  Only the 10 NEWEST postings per category are server-rendered on an allowed path, out of
  the many hundreds the portal holds. Every filter above therefore narrows those 10 per
  category rather than searching the whole board. \`meta.categories[].resultsCount\` reports
  the real total so the gap is always visible. This makes the skill a good daily
  "what's new" feed and a poor exhaustive search.

EXAMPLES
  bun run src/cli.ts categories
  bun run src/cli.ts search -c testing --format table
  bun run src/cli.ts search -c testing,devops,cloud-engineering -l krakow --format table
  bun run src/cli.ts search -c testing -q playwright --seniority mid --format table
  bun run src/cli.ts search -c devops,support,helpdesk --remote --jobage 3 --format table
  bun run src/cli.ts detail 398090-tester-automatyzujacy-itfs --format plain

Personal use only — reads allowed public pages, never /api/ or /redirect/. Keep volume low.
`

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  if (cmd === "categories") {
    process.stdout.write(CATEGORIES.join("\n") + "\n")
    return 0
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

    let categories: string[] = []
    if (typeof flags.category === "string") {
      const { categories: valid, invalid } = parseCategories(flags.category)
      if (invalid.length > 0) {
        process.stderr.write(
          JSON.stringify({
            error: `Unknown category slug(s): ${invalid.join(", ")}. Valid: ${CATEGORIES.join(", ")}`,
            code: "BAD_CATEGORY",
          }) + "\n",
        )
        return 1
      }
      categories = valid
    }

    const opts: SearchOpts = {
      categories,
      query: typeof flags.query === "string" ? flags.query : undefined,
      city: typeof flags.city === "string" ? flags.city : undefined,
      seniority: typeof flags.seniority === "string" ? flags.seniority : undefined,
      remote: flags.remote === true || flags.remote === "true",
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
        JSON.stringify({ error: "detail requires an <id|url>", code: "NO_ID" }) + "\n",
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
