/**
 * The entry-point module paths named by a deno.json `exports` value — one for a bare
 * string, every string value for a map, none for anything else.
 */
export const entryPointsOf = (exports: unknown): ReadonlyArray<string> => {
  if (typeof exports === "string") return [exports]

  if (typeof exports === "object" && exports !== null) {
    return Object.values(exports).filter((value): value is string => typeof value === "string")
  }

  return []
}
