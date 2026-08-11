import { describe, expect, test } from "bun:test"
import { runCLI } from "./helpers.js"

describe("CLI contract", () => {
  test("no command prints help and exits 1", async () => {
    const r = await runCLI([])
    expect(r.exitCode).toBe(1)
    expect(r.stdout).toContain("czyjesteldorado-cli")
  })

  test("--help exits 0 and documents the coverage limit", async () => {
    const r = await runCLI(["search", "--help"])
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toContain("COVERAGE")
    expect(r.stdout).toContain("10 NEWEST")
  })

  test("categories lists the portal's slugs", async () => {
    const r = await runCLI(["categories"])
    expect(r.exitCode).toBe(0)
    expect(r.stdout.split("\n")).toContain("testing")
    expect(r.stdout.split("\n")).toContain("cloud-engineering")
  })

  test("unknown command errors as JSON on stderr", async () => {
    const r = await runCLI(["frobnicate"])
    expect(r.exitCode).toBe(1)
    expect(r.stdout).toBe("")
    expect(JSON.parse(r.stderr).code).toBe("BAD_CMD")
  })

  test("search without --category errors instead of guessing one", async () => {
    const r = await runCLI(["search", "-q", "qa"])
    expect(r.exitCode).toBe(1)
    expect(r.stdout).toBe("")
    const err = JSON.parse(r.stderr)
    expect(err.code).toBe("NO_CATEGORY")
    expect(err.error).toContain("testing")
  })

  test("an unknown category slug is rejected, not silently dropped", async () => {
    const r = await runCLI(["search", "-c", "testing,qa-wizard"])
    expect(r.exitCode).toBe(1)
    expect(JSON.parse(r.stderr).code).toBe("BAD_CATEGORY")
  })

  test("--page beyond 1 fails loudly instead of repeating the same 10", async () => {
    const r = await runCLI(["search", "-c", "testing", "--page", "2"])
    expect(r.exitCode).toBe(1)
    expect(r.stdout).toBe("")
    expect(JSON.parse(r.stderr).code).toBe("PAGE_UNSUPPORTED")
  })

  test("non-numeric --limit errors as JSON on stderr", async () => {
    const r = await runCLI(["search", "-c", "testing", "--limit", "abc"])
    expect(r.exitCode).toBe(1)
    expect(JSON.parse(r.stderr).code).toBe("BAD_ARG")
  })

  test("detail without an id errors as JSON on stderr", async () => {
    const r = await runCLI(["detail"])
    expect(r.exitCode).toBe(1)
    expect(JSON.parse(r.stderr).code).toBe("NO_ID")
  })

  test("detail rejects a bare numeric id before any network call", async () => {
    const r = await runCLI(["detail", "398090"])
    expect(r.exitCode).toBe(1)
    const err = JSON.parse(r.stderr)
    expect(err.code).toBe("BAD_ID")
    expect(err.error).toContain("slug")
  })
})
