import { assertEquals } from "@std/assert"
import { resolve } from "@std/path"
import { isTestFile, layerOf, relativeImportVisitor, relPath } from "../lint-helpers.ts"
import { toPosix } from "../src/lint-helpers.ts"

Deno.test("toPosix - turns Windows separators into forward slashes", () => {
  assertEquals(toPosix("src\\domain\\a.ts"), "src/domain/a.ts")
})

Deno.test("relPath - is relative to the directory lint runs from", () => {
  assertEquals(relPath(resolve(Deno.cwd(), "src/domain/a.ts")), "src/domain/a.ts")
})

Deno.test("layerOf - reads the layer from the folder under src/", () => {
  assertEquals(layerOf("src/domain/a.ts"), "domain")
  assertEquals(layerOf("src/presentation/columns/a.ts"), "presentation")
})

Deno.test("layerOf - anything outside a layer folder has no layer", () => {
  assertEquals(layerOf("src/init/entry.ts"), null)
  assertEquals(layerOf("scripts/a.ts"), null)
})

Deno.test("isTestFile - test files and anything under the root tests folder are test code", () => {
  assertEquals(isTestFile("src/a.test.ts"), true)
  assertEquals(isTestFile("tests/support/a.ts"), true)
  assertEquals(isTestFile("src/a.ts"), false)
})

Deno.test("relativeImportVisitor - reports each relative specifier with its resolved target", () => {
  const seen: Array<string> = []
  const plugin: Deno.lint.Plugin = {
    name: "probe",
    rules: {
      imports: {
        create: () =>
          relativeImportVisitor(resolve(Deno.cwd(), "src/domain"), (_source, target) => {
            seen.push(target)
          }),
      },
    },
  }
  Deno.lint.runPlugin(
    plugin,
    "src/domain/a.ts",
    'import { x } from "../application/b.ts"\nimport { y } from "@std/path"\nexport * from "./c.ts"',
  )
  assertEquals(seen, ["src/application/b.ts", "src/domain/c.ts"])
})
