/**
 * Fails when a public-exported runtime value (function / class / variable) reachable from
 * an entry point has zero word-boundary references in `tests/`.
 *
 * Type-only exports are skipped — they have no runtime to exercise. Entry points are read
 * from the `exports` of the invoking repository's deno.json, deno.jsonc or jsr.json, so a
 * package with more than one entry point gates every public surface. Exports that need no
 * test of their own — protocol-defined constants whose only possible test would restate
 * their value — are exempted by pattern:
 *
 * ```json
 * { "tasks": { "exports-tested": "deno run --allow-read --allow-run jsr:@innis/coding-standards/check-exports-tested -- --exempt '^KIND_'" } }
 * ```
 *
 * @module
 */

// deno-lint-ignore-file no-console -- Deliberate: a check script reports through the console
import { readEntryPoints, runDenoDoc } from "./src/deno-doc.ts"
import { publicValueExports } from "./src/doc-symbols.ts"
import { exemptPatternFrom, untestedExports } from "./src/exports-tested.ts"

const TEST_ROOT = "tests"

const walkTestFiles = async function* (dir: string): AsyncGenerator<string> {
  for await (const entry of Deno.readDir(dir)) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory) yield* walkTestFiles(path)
    else if (entry.isFile && path.endsWith(".test.ts")) yield path
  }
}

const readAllTestContent = async (): Promise<string> => {
  const parts: Array<string> = []
  for await (const path of walkTestFiles(TEST_ROOT)) {
    parts.push(await Deno.readTextFile(path))
  }
  return parts.join("\n")
}

const hasTestRoot = async (): Promise<boolean> => {
  try {
    return (await Deno.stat(TEST_ROOT)).isDirectory
  } catch {
    return false
  }
}

const main = async (): Promise<void> => {
  const entries = await readEntryPoints()

  if (entries.length === 0) {
    console.error("No `exports` to check in deno.json, deno.jsonc or jsr.json.")
    Deno.exit(1)
  }

  if (!(await hasTestRoot())) {
    console.error(`No ${TEST_ROOT}/ directory to search for test references.`)
    Deno.exit(1)
  }

  const names = publicValueExports(await runDenoDoc(entries))
  const untested = untestedExports(names, await readAllTestContent(), exemptPatternFrom(Deno.args))

  if (untested.length > 0) {
    console.error(`Found ${untested.length} public value export(s) with no test reference:`)
    for (const name of untested) console.error(`  - ${name}`)
    console.error(`\nEvery public runtime export from an entry point must be referenced by at least one test.`)
    Deno.exit(1)
  }

  console.log(`All ${names.length} public value exports are referenced by at least one test.`)
}

if (import.meta.main) await main()
