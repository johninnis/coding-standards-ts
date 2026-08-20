/**
 * The innis deno lint plugin.
 *
 * Point a repository's `lint.plugins` at this module:
 *
 * ```json
 * { "lint": { "plugins": ["jsr:@innis/coding-standards@^0.1.0/lint-plugin"] } }
 * ```
 *
 * The layer rules resolve filenames against the directory `deno lint` runs from, so run it
 * from the repository root — which is where deno runs configured tasks anyway.
 *
 * @module
 */

export { default } from "./src/lint-plugin.ts"
