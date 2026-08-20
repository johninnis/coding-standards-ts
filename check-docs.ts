/**
 * Fails when a public export reachable from an entry point has no JSDoc.
 *
 * "Public" is any symbol with an `export` declaration in the entry-point graph, resolved
 * through re-export barrels — the same surface JSR scores for its documentation rating,
 * covering values and types alike. Entry points are read from the `exports` of the invoking
 * repository's deno.json, deno.jsonc or jsr.json:
 *
 * ```json
 * { "tasks": { "docs": "deno run --allow-read --allow-run jsr:@innis/coding-standards/check-docs" } }
 * ```
 *
 * @module
 */

// deno-lint-ignore-file no-console -- Deliberate: a check script reports through the console
import { readEntryPoints, runDenoDoc } from "./src/deno-doc.ts"
import { docCoverageOf } from "./src/doc-symbols.ts"

const main = async (): Promise<void> => {
  const entries = await readEntryPoints()

  if (entries.length === 0) {
    console.error("No `exports` to document in deno.json, deno.jsonc or jsr.json.")
    Deno.exit(1)
  }

  const { total, undocumented } = docCoverageOf(await runDenoDoc(entries))

  if (undocumented.length > 0) {
    console.error(`Found ${undocumented.length} undocumented public export(s):`)
    for (const name of undocumented) console.error(`  - ${name}`)
    console.error(`\nEvery public export from ${entries.join(", ")} must have a JSDoc comment.`)
    Deno.exit(1)
  }

  console.log(`All ${total} public exports have documentation.`)
}

if (import.meta.main) await main()
