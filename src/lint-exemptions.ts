import { fromFileUrl, relative } from "@std/path"
import { toPosix } from "./lint-helpers.ts"

/** Rules a lint pass turns off for the paths it lints: the second pass of the two-pass lint task. */
export interface LintExemption {
  readonly rules: ReadonlyArray<string>
  readonly paths: ReadonlyArray<string>
}

/** One diagnostic a lint run reported: the repository-relative file it fired in and the rule that fired. */
export interface LintFinding {
  readonly file: string
  readonly code: string
}

const RULES_EXCLUDE = "--rules-exclude"

const commandOf = (task: unknown): string => {
  if (typeof task === "string") return task
  if (typeof task !== "object" || task === null) return ""
  const command: unknown = Reflect.get(task, "command")
  return typeof command === "string" ? command : ""
}

const exemptionOf = (pass: ReadonlyArray<string>): LintExemption | null => {
  const rules: Array<string> = []
  const paths: Array<string> = []
  for (let i = 2; i < pass.length; i++) {
    const token = pass[i] ?? ""
    if (token === RULES_EXCLUDE) rules.push(...(pass[++i] ?? "").split(","))
    else if (token.startsWith(`${RULES_EXCLUDE}=`)) rules.push(...token.slice(RULES_EXCLUDE.length + 1).split(","))
    else if (!token.startsWith("-")) paths.push(token)
  }
  const named = rules.filter((rule) => rule !== "")
  return named.length > 0 ? { rules: named, paths } : null
}

/**
 * The exemptions a deno.json `lint` task holds — one per `deno lint` pass that excludes rules, naming those rules and
 * the paths the pass lints. The task may be a command string or a task object with a `command`.
 */
export const lintExemptionsOf = (task: unknown): ReadonlyArray<LintExemption> =>
  commandOf(task)
    .split("&&")
    .map((pass) => pass.trim().split(/\s+/))
    .filter((pass) => pass[0] === "deno" && pass[1] === "lint")
    .map(exemptionOf)
    .filter((exemption): exemption is LintExemption => exemption !== null)

const withoutDotSlash = (path: string): string => path.replace(/^\.\//, "")

const firesUnder = (findings: ReadonlyArray<LintFinding>, rule: string, path: string): boolean => {
  const target = withoutDotSlash(path).replace(/\/$/, "")
  return findings.some((finding) =>
    finding.code === rule && (finding.file === target || finding.file.startsWith(`${target}/`))
  )
}

/**
 * Each exempted rule-and-path pair the rule no longer fires under, given what linting those paths with every rule on
 * reported: a file the rule found nothing in, or a directory with no file it fired in. An exemption with no paths
 * covers the whole package and is kept by any finding of its rule.
 */
export const unmatchedExemptions = (
  exemptions: ReadonlyArray<LintExemption>,
  findings: ReadonlyArray<LintFinding>,
): ReadonlyArray<string> =>
  exemptions.flatMap(({ rules, paths }) =>
    rules.flatMap((rule) => {
      if (paths.length === 0) {
        return findings.some((finding) => finding.code === rule) ? [] : [`${rule} in the package`]
      }
      return paths.filter((path) => !firesUnder(findings, rule, path)).map((path) => `${rule} in ${path}`)
    })
  )

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

const findingOf = (diagnostic: unknown, root: string): LintFinding => {
  const filename = isRecord(diagnostic) ? diagnostic.filename : undefined
  const code = isRecord(diagnostic) ? diagnostic.code : undefined
  if (typeof filename !== "string" || typeof code !== "string") {
    throw new Error("deno lint --json printed a diagnostic these checks do not recognise")
  }
  return { file: toPosix(relative(root, fromFileUrl(filename))), code }
}

/**
 * The findings in what `deno lint --json` printed, with files relative to `root`. Throws when the output is not that
 * shape, or when the run reported errors (a file it could not parse, a plugin it could not load) rather than findings.
 */
export const findingsOf = (output: unknown, root: string): ReadonlyArray<LintFinding> => {
  const diagnostics = isRecord(output) ? output.diagnostics : undefined
  const errors = isRecord(output) ? output.errors : undefined
  if (!Array.isArray(diagnostics) || !Array.isArray(errors)) {
    throw new Error("deno lint --json printed a shape these checks do not recognise")
  }
  if (errors.length > 0) throw new Error(`deno lint reported errors: ${JSON.stringify(errors)}`)
  return diagnostics.map((diagnostic) => findingOf(diagnostic, root))
}
