/** One declaration of a symbol as `deno doc --json` reports it. */
export interface DocDeclaration {
  readonly declarationKind: string
  readonly kind: string
  readonly jsDoc?: { readonly doc?: string }
}

/** One named symbol as `deno doc --json` reports it, with every declaration it has. */
export interface DocSymbol {
  readonly name: string
  readonly declarations: ReadonlyArray<DocDeclaration>
}

/** One documented module as `deno doc --json` reports it. */
export interface DocNode {
  readonly symbols?: ReadonlyArray<DocSymbol>
}

/** The whole `deno doc --json` output for one or more entry points. */
export interface DocOutput {
  readonly nodes: Record<string, DocNode>
}

/** How much of a public surface carries documentation: every export, and the undocumented ones. */
export interface DocCoverage {
  readonly total: number
  readonly undocumented: ReadonlyArray<string>
}

const VALUE_KINDS: ReadonlySet<string> = new Set(["function", "class", "variable"])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isDocDeclaration = (value: unknown): value is DocDeclaration =>
  isRecord(value) && typeof value.declarationKind === "string" && typeof value.kind === "string" &&
  (value.jsDoc === undefined ||
    (isRecord(value.jsDoc) && (value.jsDoc.doc === undefined || typeof value.jsDoc.doc === "string")))

const isDocSymbol = (value: unknown): value is DocSymbol =>
  isRecord(value) && typeof value.name === "string" && Array.isArray(value.declarations) &&
  value.declarations.every(isDocDeclaration)

const isDocNode = (value: unknown): value is DocNode =>
  isRecord(value) && (value.symbols === undefined || (Array.isArray(value.symbols) && value.symbols.every(isDocSymbol)))

/** Whether `value` has the shape `deno doc --json` prints, as far as these checks read it. */
export const isDocOutput = (value: unknown): value is DocOutput =>
  isRecord(value) && isRecord(value.nodes) && Object.values(value.nodes).every(isDocNode)

const isPublic = (symbol: DocSymbol): boolean =>
  symbol.declarations.some((declaration) => declaration.declarationKind === "export")

const isDocumented = (symbol: DocSymbol): boolean =>
  symbol.declarations.some((declaration) => (declaration.jsDoc?.doc ?? "").trim() !== "")

const publicSymbols = (doc: DocOutput): ReadonlyArray<DocSymbol> =>
  Object.values(doc.nodes).flatMap((node) => node.symbols ?? []).filter(isPublic)

/**
 * Every public export in the documented surface, and which of them carry no JSDoc.
 *
 * A symbol exported from more than one entry point counts once, and counts as documented
 * when any of its declarations is.
 */
export const docCoverageOf = (doc: DocOutput): DocCoverage => {
  const documented = new Map<string, boolean>()

  for (const symbol of publicSymbols(doc)) {
    documented.set(symbol.name, (documented.get(symbol.name) ?? false) || isDocumented(symbol))
  }

  return {
    total: documented.size,
    undocumented: [...documented.entries()].filter(([, hasDoc]) => !hasDoc).map(([name]) => name).sort(),
  }
}

/**
 * Every public export that exists at runtime — functions, classes and variables. Type-only
 * exports are omitted: they have no runtime to exercise.
 */
export const publicValueExports = (doc: DocOutput): ReadonlyArray<string> => {
  const names = new Set<string>()

  for (const symbol of publicSymbols(doc)) {
    const hasValueExport = symbol.declarations.some(
      (declaration) => declaration.declarationKind === "export" && VALUE_KINDS.has(declaration.kind),
    )
    if (hasValueExport) names.add(symbol.name)
  }

  return [...names].sort()
}
