import { assert, assertEquals } from "@std/assert"
import { default as plugin } from "../lint-plugin.ts"

const idsFor = (fileName: string, source: string): ReadonlyArray<string> =>
  Deno.lint.runPlugin(plugin, fileName, source).map((diagnostic) => diagnostic.id)

Deno.test("a type assertion is flagged", () => {
  assert(idsFor("a.ts", "const a: unknown = 1 as string").includes("innis/no-type-assertions"))
})

Deno.test("a const assertion is not a type assertion", () => {
  assertEquals(idsFor("a.ts", "const a = [1] as const").includes("innis/no-type-assertions"), false)
})

Deno.test("a fourth parameter is flagged", () => {
  assert(
    idsFor("a.ts", "export const f = (a: number, b: number, c: number, d: number): number => a")
      .includes("innis/max-params"),
  )
})

Deno.test("the max-params message says to decompose, not to bundle a parameter object", () => {
  const diagnostics = Deno.lint.runPlugin(
    plugin,
    "a.ts",
    "export const f = (a: number, b: number, c: number, d: number): number => a",
  )
  const oversupplied = diagnostics.find((diagnostic) => diagnostic.id === "innis/max-params")

  assert(oversupplied !== undefined)
  assert(oversupplied.message.includes("Decompose the unit"))
})

Deno.test("three parameters are fine", () => {
  assertEquals(
    idsFor("a.ts", "export const f = (a: number, b: number, c: number): number => a").includes("innis/max-params"),
    false,
  )
})

Deno.test("an emoji is flagged outside tests", () => {
  assert(idsFor("a.ts", 'const rocket = "\u{1F680}"').includes("innis/no-emoji"))
})

Deno.test("an emoji inside a test file is tolerated", () => {
  assertEquals(idsFor("tests/a.test.ts", 'const rocket = "\u{1F680}"').includes("innis/no-emoji"), false)
})

Deno.test("the text-presentation symbols copyright, registered and trademark are not emoji", () => {
  assertEquals(idsFor("a.ts", '// Copyright © 2026\nconst notice = "® ™"').includes("innis/no-emoji"), false)
})

Deno.test("a symbol forced to emoji presentation by a variation selector is an emoji", () => {
  assert(idsFor("a.ts", 'const notice = "\u{00A9}\u{FE0F}"').includes("innis/no-emoji"))
})

Deno.test("a filename that is not kebab-case is flagged", () => {
  assert(idsFor("BadFile.ts", "const a = 1").includes("innis/kebab-case-filename"))
})

Deno.test("a kebab-case filename with dotted suffixes is fine", () => {
  assertEquals(idsFor("good-file.test.ts", "const a = 1").includes("innis/kebab-case-filename"), false)
})

Deno.test("a windows path with a kebab-case basename is fine", () => {
  assertEquals(idsFor("C:\\repo\\src\\good-file.ts", "const a = 1").includes("innis/kebab-case-filename"), false)
})

Deno.test("a file over five hundred lines is flagged", () => {
  assert(idsFor("a.ts", "const a = 1\n".repeat(501)).includes("innis/max-file-lines"))
})

Deno.test("a file of exactly five hundred lines with a trailing newline is fine", () => {
  assertEquals(idsFor("a.ts", "const a = 1\n".repeat(500)).includes("innis/max-file-lines"), false)
})

Deno.test("the reported line count does not include the trailing newline", () => {
  const diagnostics = Deno.lint.runPlugin(plugin, "a.ts", "const a = 1\n".repeat(501))
  const oversize = diagnostics.find((diagnostic) => diagnostic.id === "innis/max-file-lines")

  assert(oversize !== undefined)
  assert(oversize.message.includes("501 lines"))
})

Deno.test("a us spelling in an identifier is flagged with the uk family", () => {
  const diagnostics = Deno.lint.runPlugin(plugin, "a.ts", "const colorValue = 1")
  const spelling = diagnostics.find((diagnostic) => diagnostic.id === "innis/uk-english")

  assert(spelling !== undefined)
  assert(spelling.message.includes("colour"))
})

Deno.test("a deserialize identifier is told the deserialise family, not serialise", () => {
  const diagnostics = Deno.lint.runPlugin(plugin, "a.ts", "const deserializePayload = 1")
  const spelling = diagnostics.find((diagnostic) => diagnostic.id === "innis/uk-english")

  assert(spelling !== undefined)
  assert(spelling.message.includes("deserialise"))
})

Deno.test("a us spelling inside a camelCase compound is flagged", () => {
  assert(idsFor("a.ts", "const backgroundColor = 1").includes("innis/uk-english"))
})

Deno.test("a us spelling inside a screaming-snake identifier is flagged", () => {
  assert(idsFor("a.ts", "const BACKGROUND_COLOR = 1").includes("innis/uk-english"))
})

Deno.test("a us spelling in an interface method name is flagged", () => {
  assert(idsFor("a.ts", "export interface A { initializeThing(): void }").includes("innis/uk-english"))
})

Deno.test("a us spelling in a parameter name is flagged", () => {
  assert(idsFor("a.ts", "export const f = (textColor: string): string => textColor").includes("innis/uk-english"))
})

Deno.test("a uk spelling is fine", () => {
  assertEquals(idsFor("a.ts", "const colourValue = 1").includes("innis/uk-english"), false)
})

Deno.test("a us spelling on an interface property is flagged", () => {
  assert(idsFor("a.ts", "export interface A { readonly behaviorMode: number }").includes("innis/uk-english"))
})

Deno.test("domain importing infrastructure is a layer violation", () => {
  assert(
    idsFor("src/domain/value-object/thing.ts", 'import { x } from "../../infrastructure/http/client.ts"')
      .includes("innis/no-layer-violation"),
  )
})

Deno.test("domain importing application is a layer violation", () => {
  assert(
    idsFor("src/domain/thing.ts", 'import { x } from "../application/service/y.ts"')
      .includes("innis/no-layer-violation"),
  )
})

Deno.test("application importing domain points inward and is fine", () => {
  assertEquals(
    idsFor("src/application/service/y.ts", 'import { x } from "../../domain/value-object/thing.ts"')
      .includes("innis/no-layer-violation"),
    false,
  )
})

Deno.test("a dynamic import pointing outward is a layer violation", () => {
  assert(
    idsFor("src/domain/thing.ts", 'export const f = (): Promise<unknown> => import("../infrastructure/db.ts")')
      .includes("innis/no-layer-violation"),
  )
})

Deno.test("a dynamic import of a non-literal specifier is not resolvable and not flagged", () => {
  assertEquals(
    idsFor("src/domain/thing.ts", "export const f = (path: string): Promise<unknown> => import(path)")
      .includes("innis/no-layer-violation"),
    false,
  )
})

Deno.test("a file outside the layer folders imports freely", () => {
  assertEquals(
    idsFor("src/composition.ts", 'import { x } from "./infrastructure/http/client.ts"')
      .includes("innis/no-layer-violation"),
    false,
  )
})

Deno.test("a catch in the domain layer is flagged", () => {
  assert(
    idsFor("src/domain/service/a.ts", "export const f = (): void => { try { f() } catch { return } }")
      .includes("innis/no-catch-in-layer"),
  )
})

Deno.test("a promise .catch in the domain layer is flagged", () => {
  assert(
    idsFor("src/domain/service/a.ts", "export const f = (p: Promise<number>): Promise<number> => p.catch(() => 0)")
      .includes("innis/no-catch-in-layer"),
  )
})

Deno.test("a promise .catch in infrastructure is where catches belong", () => {
  assertEquals(
    idsFor("src/infrastructure/http/a.ts", "export const f = (p: Promise<number>): Promise<number> => p.catch(() => 0)")
      .includes("innis/no-catch-in-layer"),
    false,
  )
})

Deno.test("a catch in infrastructure is where catches belong", () => {
  assertEquals(
    idsFor("src/infrastructure/http/a.ts", "export const f = (): void => { try { f() } catch { return } }")
      .includes("innis/no-catch-in-layer"),
    false,
  )
})
