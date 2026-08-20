const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * Which of the named exports have no word-boundary reference in the given test content.
 *
 * `exempt` names exports that need no test of their own — protocol-defined constants whose
 * only possible test would restate their value. Null exempts nothing.
 */
export const untestedExports = (
  names: ReadonlyArray<string>,
  testContent: string,
  exempt: RegExp | null,
): ReadonlyArray<string> =>
  names
    .filter((name) => !(exempt?.test(name) ?? false))
    .filter((name) => !new RegExp(`\\b${escapeRegex(name)}\\b`).test(testContent))
    .sort()

/**
 * The exemption pattern named by a `--exempt <regex>` (or `--exempt=<regex>`) argument, or
 * null when the arguments name none.
 */
export const exemptPatternFrom = (args: ReadonlyArray<string>): RegExp | null => {
  const joined = args.findIndex((arg) => arg.startsWith("--exempt="))

  if (joined >= 0) return patternOrNull(args[joined]?.slice("--exempt=".length))

  const flag = args.indexOf("--exempt")

  return flag >= 0 ? patternOrNull(args[flag + 1]) : null
}

const patternOrNull = (value: string | undefined): RegExp | null =>
  value === undefined || value === "" ? null : new RegExp(value)
