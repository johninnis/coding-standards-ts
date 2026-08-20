import { assertEquals } from "@std/assert"
import { entryPointsOf } from "../src/entry-points.ts"

Deno.test("a bare string is the one entry point", () => {
  assertEquals(entryPointsOf("./mod.ts"), ["./mod.ts"])
})

Deno.test("a map yields every entry point", () => {
  assertEquals(entryPointsOf({ ".": "./mod.ts", "./session": "./session.ts" }), ["./mod.ts", "./session.ts"])
})

Deno.test("anything else names no entry points", () => {
  assertEquals(entryPointsOf(undefined), [])
  assertEquals(entryPointsOf(null), [])
  assertEquals(entryPointsOf(42), [])
})
