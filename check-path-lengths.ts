/**
 * Fails when a tracked path holds a component longer than JSR accepts.
 *
 * JSR refuses any path component over 95 characters, and `deno publish --dry-run` does not check it, so a long
 * filename (an ADR's, typically) passes every gate and fails only the real publish. Every path `git ls-files` lists
 * is checked:
 *
 * ```json
 * { "tasks": { "path-lengths": "deno run --allow-run=git jsr:@innis/coding-standards@^0.2.3/check-path-lengths" } }
 * ```
 *
 * @module
 */

import { MAX_PATH_COMPONENT_LENGTH, overlongPaths } from "./src/path-lengths.ts"

const trackedPaths = async (): Promise<ReadonlyArray<string>> => {
  const { code, stdout, stderr } = await new Deno.Command("git", {
    args: ["ls-files", "-z"],
    stdout: "piped",
    stderr: "piped",
  })
    .output()
  if (code !== 0) throw new Error(`git ls-files failed (exit ${code}): ${new TextDecoder().decode(stderr).trim()}`)
  return new TextDecoder().decode(stdout).split("\0").filter((path) => path !== "")
}

const main = async (): Promise<void> => {
  const paths = await trackedPaths()
  const overlong = overlongPaths(paths)

  if (overlong.length > 0) {
    console.error(`Found ${overlong.length} path(s) with a component over ${MAX_PATH_COMPONENT_LENGTH} characters:`)
    for (const path of overlong) console.error(`  - ${path}`)
    console.error(`\nShorten each: JSR refuses a longer path component, and the limit holds in every Innis repository.`)
    Deno.exit(1)
  }

  console.log(
    `All ${paths.length} tracked path(s) keep every component within ${MAX_PATH_COMPONENT_LENGTH} characters.`,
  )
}

if (import.meta.main) await main()
