import { assertEquals } from "@std/assert"
import { exemptPatternFrom, untestedExports } from "../src/exports-tested.ts"

Deno.test("an export referenced in a test is tested", () => {
  assertEquals(untestedExports(["signerFor"], "await signerFor(descriptor)", null), [])
})

Deno.test("an export never referenced is reported", () => {
  assertEquals(untestedExports(["signerFor", "forgotten"], "await signerFor(descriptor)", null), ["forgotten"])
})

Deno.test("a substring match is no reference", () => {
  assertEquals(untestedExports(["sign"], "await signerFor(descriptor)", null), ["sign"])
})

Deno.test("an exempted export needs no test", () => {
  assertEquals(untestedExports(["KIND_NOTE", "publish"], "publish()", /^KIND_/), [])
})

Deno.test("the report is sorted", () => {
  assertEquals(untestedExports(["zeta", "alpha"], "", null), ["alpha", "zeta"])
})

Deno.test("--exempt with a following value names the pattern", () => {
  const pattern = exemptPatternFrom(["--exempt", "^KIND_"])

  assertEquals(pattern?.test("KIND_NOTE"), true)
  assertEquals(pattern?.test("publish"), false)
})

Deno.test("--exempt= joined form names the pattern too", () => {
  assertEquals(exemptPatternFrom(["--exempt=^KIND_"])?.test("KIND_NOTE"), true)
})

Deno.test("no arguments exempt nothing", () => {
  assertEquals(exemptPatternFrom([]), null)
})

Deno.test("--exempt without a value exempts nothing", () => {
  assertEquals(exemptPatternFrom(["--exempt"]), null)
  assertEquals(exemptPatternFrom(["--exempt", ""]), null)
})
