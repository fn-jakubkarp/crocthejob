import { describe, expect, test } from "bun:test"
import { runCLI } from "./helpers.js"

describe("CLI contract", () => {
  test("no command prints help and exits 1", async () => {
    const r = await runCLI([])
    expect(r.exitCode).toBe(1)
    expect(r.stdout).toContain("nofluffjobs-cli")
  })

  test("--help exits 0", async () => {
    const r = await runCLI(["search", "--help"])
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toContain("SEARCH FLAGS")
  })

  test("unknown command errors as JSON on stderr", async () => {
    const r = await runCLI(["frobnicate"])
    expect(r.exitCode).toBe(1)
    expect(r.stdout).toBe("")
    expect(JSON.parse(r.stderr).code).toBe("BAD_CMD")
  })

  test("non-numeric --limit errors as JSON on stderr", async () => {
    const r = await runCLI(["search", "--limit", "abc"])
    expect(r.exitCode).toBe(1)
    expect(r.stdout).toBe("")
    const err = JSON.parse(r.stderr)
    expect(err.code).toBe("BAD_ARG")
    expect(err.error).toContain("--limit")
  })

  test("--jobage is rejected loudly, since cards carry no date", async () => {
    const r = await runCLI(["search", "-q", "qa", "--jobage", "7"])
    expect(r.exitCode).toBe(1)
    expect(r.stdout).toBe("")
    expect(JSON.parse(r.stderr).code).toBe("JOBAGE_UNSUPPORTED")
  })

  test("detail without an id errors as JSON on stderr", async () => {
    const r = await runCLI(["detail"])
    expect(r.exitCode).toBe(1)
    expect(JSON.parse(r.stderr).code).toBe("NO_ID")
  })

  test("detail with an unparsable id errors before any network call", async () => {
    const r = await runCLI(["detail", "1234"])
    expect(r.exitCode).toBe(1)
    expect(JSON.parse(r.stderr).code).toBe("BAD_ID")
  })
})
