/**
 * Fails when the summed lcov line coverage is under the eighty percent floor.
 *
 * Reads the report the shared `coverage` task writes:
 *
 * ```json
 * { "tasks": { "coverage": "... && deno run --allow-read jsr:@innis/coding-standards/check-coverage" } }
 * ```
 *
 * @module
 */

// deno-lint-ignore-file no-console -- Deliberate: a check script reports through the console
import { coveragePercent, lineCoverageOf } from "./src/line-coverage.ts"

const LCOV_PATH = "cov_profile/lcov.info"
const FLOOR_PERCENT = 80

const readLcov = async (): Promise<string> => {
  try {
    return await Deno.readTextFile(LCOV_PATH)
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error
    console.error(`No coverage report at ${LCOV_PATH}. Run \`deno task coverage\` first.`)
    Deno.exit(1)
  }
}

const main = async (): Promise<void> => {
  const coverage = lineCoverageOf(await readLcov())

  if (coverage.found === 0) {
    console.error(`No coverage data in ${LCOV_PATH}. Run \`deno task coverage\` first.`)
    Deno.exit(1)
  }

  const pct = coveragePercent(coverage)

  if (pct < FLOOR_PERCENT) {
    console.error(
      `Line coverage ${pct}% is below the ${FLOOR_PERCENT}% floor (${coverage.hit}/${coverage.found} lines).`,
    )
    Deno.exit(1)
  }

  console.log(`Line coverage: ${pct}% (floor ${FLOOR_PERCENT}%, ${coverage.hit}/${coverage.found} lines).`)
}

if (import.meta.main) await main()
