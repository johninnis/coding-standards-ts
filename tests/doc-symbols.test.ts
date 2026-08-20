import { assertEquals } from "@std/assert"
import type { DocDeclaration, DocOutput } from "../src/doc-symbols.ts"
import { docCoverageOf, publicValueExports } from "../src/doc-symbols.ts"

const declaration = (overrides: Partial<DocDeclaration>): DocDeclaration => ({
  declarationKind: "export",
  kind: "function",
  ...overrides,
})

const output = (nodes: DocOutput["nodes"]): DocOutput => ({ nodes })

Deno.test("a documented export is counted and not reported", () => {
  const doc = output({
    "file:///mod.ts": { symbols: [{ name: "f", declarations: [declaration({ jsDoc: { doc: "Does f." } })] }] },
  })

  assertEquals(docCoverageOf(doc), { total: 1, undocumented: [] })
})

Deno.test("an undocumented export is reported by name", () => {
  const doc = output({
    "file:///mod.ts": { symbols: [{ name: "f", declarations: [declaration({})] }] },
  })

  assertEquals(docCoverageOf(doc), { total: 1, undocumented: ["f"] })
})

Deno.test("whitespace-only jsdoc is no documentation", () => {
  const doc = output({
    "file:///mod.ts": { symbols: [{ name: "f", declarations: [declaration({ jsDoc: { doc: "  " } })] }] },
  })

  assertEquals(docCoverageOf(doc).undocumented, ["f"])
})

Deno.test("a symbol documented at one of its declarations is documented", () => {
  const doc = output({
    "file:///mod.ts": { symbols: [{ name: "f", declarations: [declaration({})] }] },
    "file:///other.ts": { symbols: [{ name: "f", declarations: [declaration({ jsDoc: { doc: "Does f." } })] }] },
  })

  assertEquals(docCoverageOf(doc), { total: 1, undocumented: [] })
})

Deno.test("a private declaration is not part of the public surface", () => {
  const doc = output({
    "file:///mod.ts": { symbols: [{ name: "hidden", declarations: [declaration({ declarationKind: "private" })] }] },
  })

  assertEquals(docCoverageOf(doc), { total: 0, undocumented: [] })
})

Deno.test("value exports are functions, classes and variables, sorted", () => {
  const doc = output({
    "file:///mod.ts": {
      symbols: [
        { name: "zeta", declarations: [declaration({ kind: "variable" })] },
        { name: "Alpha", declarations: [declaration({ kind: "class" })] },
        { name: "make", declarations: [declaration({ kind: "function" })] },
      ],
    },
  })

  assertEquals(publicValueExports(doc), ["Alpha", "make", "zeta"])
})

Deno.test("type-only exports have no runtime to exercise", () => {
  const doc = output({
    "file:///mod.ts": {
      symbols: [
        { name: "Shape", declarations: [declaration({ kind: "interface" })] },
        { name: "Alias", declarations: [declaration({ kind: "typeAlias" })] },
      ],
    },
  })

  assertEquals(publicValueExports(doc), [])
})
