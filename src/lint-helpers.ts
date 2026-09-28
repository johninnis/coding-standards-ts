import { relative, resolve } from "@std/path"

const LAYERS: ReadonlySet<string> = new Set(["domain", "application", "infrastructure", "presentation"])

/** `path` with Windows separators turned into forward slashes. */
export const toPosix = (path: string): string => path.replaceAll("\\", "/")

/** `filename` relative to the directory `deno lint` runs from (the repository root), with forward slashes. */
export const relPath = (filename: string): string => toPosix(relative(Deno.cwd(), filename))

/**
 * The clean-architecture layer a repository-relative path sits in: `domain`, `application`, `infrastructure` or
 * `presentation`, read from the folder directly under `src/`; `null` for anything outside a layer folder.
 */
export const layerOf = (relativePath: string): string | null => {
  const segments = relativePath.split("/")
  if (segments[0] !== "src") return null
  const candidate = segments[1]
  return candidate !== undefined && LAYERS.has(candidate) ? candidate : null
}

/** Whether a repository-relative path is test code: a `*.test.ts` file, or anything under the root `tests/` folder. */
export const isTestFile = (relativePath: string): boolean =>
  relativePath.endsWith(".test.ts") || relativePath.startsWith("tests/")

/**
 * A lint visitor that calls `onSource` for every literal module specifier in a file: static imports, re-exports and
 * literal dynamic imports.
 */
export const importSourceVisitor = (onSource: (source: Deno.lint.StringLiteral) => void): Deno.lint.LintVisitor => {
  const check = (source: Deno.lint.Expression | null | undefined): void => {
    if (!source || source.type !== "Literal" || typeof source.value !== "string") return
    onSource(source)
  }
  return {
    ImportDeclaration(node): void {
      check(node.source)
    },
    ExportAllDeclaration(node): void {
      check(node.source)
    },
    ExportNamedDeclaration(node): void {
      check(node.source)
    },
    ImportExpression(node): void {
      check(node.source)
    },
  }
}

/**
 * A lint visitor that calls `onImport` for every relative module specifier in a file (static imports, re-exports
 * and literal dynamic imports), with the specifier node and the target resolved against `fromDir` as a
 * repository-relative path.
 */
export const relativeImportVisitor = (
  fromDir: string,
  onImport: (source: Deno.lint.StringLiteral, target: string) => void,
): Deno.lint.LintVisitor =>
  importSourceVisitor((source): void => {
    if (!source.value.startsWith(".")) return
    onImport(source, relPath(resolve(fromDir, source.value)))
  })
