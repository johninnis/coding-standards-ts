/**
 * Fails when a lint exemption in deno.json matches nothing.
 *
 * An exemption is a `deno lint` pass of the `lint` task that excludes rules for the paths it lints — the second pass
 * of the two-pass form. Each such pass is re-run with every rule on, and every exempted rule must still fire in every
 * file it names (in at least one file under a directory it names), so an exemption is removed once nothing triggers
 * it:
 *
 * ```json
 * { "tasks": { "lint-exemptions": "deno run --allow-read --allow-run jsr:@innis/coding-standards@^0.2.1/check-lint-exemptions" } }
 * ```
 *
 * @module
 */

import { readRepositoryConfig } from "./src/deno-doc.ts"
import {
  findingsOf,
  type LintExemption,
  lintExemptionsOf,
  type LintFinding,
  unmatchedExemptions,
} from "./src/lint-exemptions.ts"

const lintTaskOf = (config: unknown): unknown => {
  const tasks = typeof config === "object" && config !== null ? Reflect.get(config, "tasks") : undefined
  return typeof tasks === "object" && tasks !== null ? Reflect.get(tasks, "lint") : undefined
}

const lintWithEveryRule = async (exemption: LintExemption): Promise<ReadonlyArray<LintFinding>> => {
  const command = new Deno.Command(Deno.execPath(), {
    args: ["lint", "--json", ...exemption.paths],
    stdout: "piped",
    stderr: "piped",
  })
  const { stdout } = await command.output()
  return findingsOf(JSON.parse(new TextDecoder().decode(stdout)), Deno.cwd())
}

const main = async (): Promise<void> => {
  const exemptions = lintExemptionsOf(lintTaskOf(await readRepositoryConfig()))
  const findings = (await Promise.all(exemptions.map(lintWithEveryRule))).flat()
  const unmatched = unmatchedExemptions(exemptions, findings)

  if (unmatched.length > 0) {
    console.error(`Found ${unmatched.length} lint exemption(s) that match nothing:`)
    for (const entry of unmatched) console.error(`  - ${entry}`)
    console.error(`\nRemove each from the deno.json lint task: the rule no longer fires there.`)
    Deno.exit(1)
  }

  console.log(`All ${exemptions.length} lint exemption pass(es) still match what they exempt.`)
}

if (import.meta.main) await main()
