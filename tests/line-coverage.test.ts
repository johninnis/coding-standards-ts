import { assertEquals } from "@std/assert"
import { coveragePercent, lineCoverageOf } from "../src/line-coverage.ts"

Deno.test("line totals are summed across files", () => {
  const lcov = "SF:a.ts\nLF:10\nLH:8\nend_of_record\nSF:b.ts\nLF:5\nLH:5\nend_of_record\n"

  assertEquals(lineCoverageOf(lcov), { found: 15, hit: 13 })
})

Deno.test("an empty report holds no lines", () => {
  assertEquals(lineCoverageOf(""), { found: 0, hit: 0 })
})

Deno.test("the percentage is rounded to one decimal place", () => {
  assertEquals(coveragePercent({ found: 15, hit: 13 }), 86.7)
})

Deno.test("no lines found reads as zero percent", () => {
  assertEquals(coveragePercent({ found: 0, hit: 0 }), 0)
})
