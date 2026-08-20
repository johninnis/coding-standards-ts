import { parse } from "@std/jsonc"
import { entryPointsOf } from "./entry-points.ts"
import type { DocOutput } from "./doc-symbols.ts"

const CONFIG_FILES: ReadonlyArray<string> = ["deno.json", "deno.jsonc", "jsr.json"]

const readFirstConfig = async (): Promise<unknown> => {
  for (const file of CONFIG_FILES) {
    try {
      return parse(await Deno.readTextFile(file))
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) continue
      throw error
    }
  }

  return null
}

/**
 * The entry points of the repository `deno run` was invoked in, from the `exports` of its
 * deno.json, deno.jsonc or jsr.json — whichever exists first, in that order.
 */
export const readEntryPoints = async (): Promise<ReadonlyArray<string>> => {
  const config = await readFirstConfig()
  const exports = typeof config === "object" && config !== null ? Reflect.get(config, "exports") : undefined

  return entryPointsOf(exports)
}

/** Runs `deno doc --json` over the entry points and parses what it prints. Throws when it fails. */
export const runDenoDoc = async (entries: ReadonlyArray<string>): Promise<DocOutput> => {
  const command = new Deno.Command(Deno.execPath(), {
    args: ["doc", "--json", ...entries],
    stdout: "piped",
    stderr: "piped",
  })
  const { code, stdout, stderr } = await command.output()

  if (code !== 0) throw new Error(`deno doc --json failed:\n${new TextDecoder().decode(stderr)}`)

  return JSON.parse(new TextDecoder().decode(stdout))
}
