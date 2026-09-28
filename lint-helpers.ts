/**
 * The path and layer helpers the innis lint plugin is built on, for a repository that adds rules of its own:
 *
 * ```ts
 * import { layerOf, relativeImportVisitor, relPath } from "jsr:@innis/coding-standards@^0.2.0/lint-helpers"
 * ```
 *
 * They resolve paths against the directory `deno lint` runs from, so run it from the repository root.
 *
 * @module
 */

export { isTestFile, layerOf, relativeImportVisitor, relPath } from "./src/lint-helpers.ts"
