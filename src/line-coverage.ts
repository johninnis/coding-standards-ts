/** Line totals summed across every file in an lcov report. */
export interface LineCoverage {
  readonly found: number
  readonly hit: number
}

/** Sums the `LF:`/`LH:` line totals of an lcov report. */
export const lineCoverageOf = (lcov: string): LineCoverage => {
  let found = 0
  let hit = 0

  for (const line of lcov.split("\n")) {
    if (line.startsWith("LF:")) found += Number(line.slice(3))
    else if (line.startsWith("LH:")) hit += Number(line.slice(3))
  }

  return { found, hit }
}

/** The hit percentage to one decimal place; zero lines found reads as zero. */
export const coveragePercent = (coverage: LineCoverage): number =>
  coverage.found === 0 ? 0 : Math.round((1000 * coverage.hit) / coverage.found) / 10
