import { assertEquals } from "@std/assert"
import { MAX_PATH_COMPONENT_LENGTH, overlongPaths } from "../src/path-lengths.ts"

Deno.test("the limit is JSR's 95 characters", () => {
  assertEquals(MAX_PATH_COMPONENT_LENGTH, 95)
})

Deno.test("a component at the limit is accepted", () => {
  assertEquals(overlongPaths([`docs/adr/${"a".repeat(92)}.md`]), [])
})

Deno.test("a file name over the limit is reported", () => {
  const path = `docs/adr/${"a".repeat(93)}.md`
  assertEquals(overlongPaths([path, "README.md"]), [path])
})

Deno.test("a directory name over the limit is reported", () => {
  const path = `${"d".repeat(96)}/file.ts`
  assertEquals(overlongPaths([path]), [path])
})

Deno.test("characters are counted, not UTF-16 units", () => {
  assertEquals(overlongPaths(["\u{1F600}".repeat(95)]), [])
})

Deno.test("an explicit limit is honoured", () => {
  assertEquals(overlongPaths(["abc", "abcd"], 3), ["abcd"])
})
