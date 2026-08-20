import { dirname, relative, resolve } from "@std/path"

const LAYERS: ReadonlySet<string> = new Set(["domain", "application", "infrastructure"])

interface LayerRule {
  readonly fromLayer: string
  readonly toLayer: string
  readonly reason: string
}

const FORBIDDEN: ReadonlyArray<LayerRule> = [
  { fromLayer: "domain", toLayer: "application", reason: "the domain layer must not depend on the application layer" },
  {
    fromLayer: "domain",
    toLayer: "infrastructure",
    reason: "the domain layer must not depend on the infrastructure layer",
  },
  {
    fromLayer: "application",
    toLayer: "infrastructure",
    reason: "the application layer must not depend on the infrastructure layer",
  },
]

// Emoji-presentation characters, plus any emoji-capable character forced to emoji
// presentation by VS16 (U+FE0F). Bare Extended_Pictographic would also flag the
// text-presentation symbols © ® ™.
const EMOJI = /\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu

const MAX_PARAMS = 3

const FILE_MAX_LINES = 500

const UK_ENGLISH_OFFENDERS: ReadonlyArray<{ readonly us: RegExp; readonly uk: string }> = [
  { us: /normaliz/i, uk: "normalise" },
  // `deserializ` before `serializ`: the first match wins, and `serializ` matches inside it.
  { us: /deserializ/i, uk: "deserialise" },
  { us: /serializ/i, uk: "serialise" },
  { us: /initializ/i, uk: "initialise" },
  { us: /customiz/i, uk: "customise" },
  { us: /synchroniz/i, uk: "synchronise" },
  { us: /recogniz/i, uk: "recognise" },
  { us: /realiz/i, uk: "realise" },
  { us: /apologiz/i, uk: "apologise" },
  { us: /\bcolor/i, uk: "colour" },
  { us: /\bcenter/i, uk: "centre" },
  { us: /favorit/i, uk: "favourite" },
  { us: /behavior/i, uk: "behaviour" },
  { us: /organiz/i, uk: "organise" },
  { us: /optimiz/i, uk: "optimise" },
  { us: /analyz/i, uk: "analyse" },
]

const ASSERTION_MESSAGE =
  "Type assertion (`as`) bypasses the type checker. Use a type guard, narrow the value, or fix the upstream type."

const toPosix = (path: string): string => path.replaceAll("\\", "/")

const relPath = (filename: string): string => toPosix(relative(Deno.cwd(), filename))

const layerOf = (relativePath: string): string | null => {
  const segments = relativePath.split("/")
  if (segments[0] !== "src") return null
  const candidate = segments[1]
  return candidate !== undefined && LAYERS.has(candidate) ? candidate : null
}

const isTestFile = (relativePath: string): boolean =>
  relativePath.endsWith(".test.ts") || relativePath.startsWith("tests/")

const relativeImportVisitor = (
  fromDir: string,
  onImport: (source: Deno.lint.StringLiteral, target: string) => void,
): Deno.lint.LintVisitor => {
  const check = (source: Deno.lint.Expression | null | undefined): void => {
    if (!source || source.type !== "Literal" || typeof source.value !== "string") return
    if (!source.value.startsWith(".")) return
    onImport(source, relPath(resolve(fromDir, source.value)))
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

// The `\b` in the offender patterns cannot see camelCase or SCREAMING_SNAKE boundaries,
// so identifiers are matched in spelled-out form: "backgroundColor" as "background color".
const spelledOut = (identifier: string): string =>
  identifier
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replaceAll("_", " ")
    .toLowerCase()

const lineCount = (text: string): number => {
  if (text === "") return 0
  const segments = text.split("\n")
  return segments.at(-1) === "" ? segments.length - 1 : segments.length
}

const isConstAssertion = (node: Deno.lint.TSAsExpression): boolean => {
  const annotation = node.typeAnnotation
  return annotation.type === "TSTypeReference" &&
    annotation.typeName.type === "Identifier" &&
    annotation.typeName.name === "const"
}

/**
 * The innis lint rules, as one deno lint plugin.
 *
 * Rules: `no-type-assertions` (no `as` other than `as const`), `no-layer-violation`
 * (relative imports under `src/` may only point inward), `no-catch-in-layer` (domain and
 * application code lets faults bubble or returns a value), `max-params` (more than three
 * parameters is a design signal), `no-emoji`, `kebab-case-filename`, `max-file-lines`
 * (five hundred), and `uk-english` (identifiers use UK spelling). Layer and path rules
 * resolve filenames against the working directory `deno lint` runs from — the consuming
 * repository's root.
 */
const plugin: Deno.lint.Plugin = {
  name: "innis",
  rules: {
    "no-type-assertions": {
      create(context): Deno.lint.LintVisitor {
        return {
          TSAsExpression(node): void {
            if (isConstAssertion(node)) return
            context.report({ node, message: ASSERTION_MESSAGE })
          },
          TSTypeAssertion(node): void {
            context.report({ node, message: ASSERTION_MESSAGE })
          },
        }
      },
    },
    "no-layer-violation": {
      create(context): Deno.lint.LintVisitor {
        const fromFile = relPath(context.filename)
        const fromLayer = layerOf(fromFile)
        if (fromLayer === null) return {}
        return relativeImportVisitor(dirname(context.filename), (source, target): void => {
          const toLayer = layerOf(target)
          if (toLayer === null) return
          const rule = FORBIDDEN.find((r) => r.fromLayer === fromLayer && r.toLayer === toLayer)
          if (rule === undefined) return
          context.report({ node: source, message: `Layer violation: ${rule.reason}.` })
        })
      },
    },
    "no-catch-in-layer": {
      create(context): Deno.lint.LintVisitor {
        const layer = layerOf(relPath(context.filename))
        if (layer !== "domain" && layer !== "application") return {}
        const message = `The ${layer} layer must not catch errors. Let them bubble or return a Result.`
        return {
          TryStatement(node): void {
            if (node.handler === null) return
            context.report({ node: node.handler, message })
          },
          CallExpression(node): void {
            const callee = node.callee
            if (callee.type !== "MemberExpression" || callee.computed) return
            if (callee.property.type !== "Identifier" || callee.property.name !== "catch") return
            context.report({ node: callee.property, message })
          },
        }
      },
    },
    "max-params": {
      create(context): Deno.lint.LintVisitor {
        const check = (
          node: Deno.lint.FunctionDeclaration | Deno.lint.FunctionExpression | Deno.lint.ArrowFunctionExpression,
        ): void => {
          if (node.params.length > MAX_PARAMS) {
            context.report({
              node,
              message:
                `Function has ${node.params.length} parameters; maximum is ${MAX_PARAMS}. Decompose the unit rather than bundling arguments into an object.`,
            })
          }
        }
        return {
          FunctionDeclaration: check,
          FunctionExpression: check,
          ArrowFunctionExpression: check,
        }
      },
    },
    "no-emoji": {
      create(context): Deno.lint.LintVisitor {
        if (isTestFile(relPath(context.filename))) return {}
        return {
          Program(): void {
            for (const match of context.sourceCode.text.matchAll(EMOJI)) {
              const matched = match[0]
              if (match.index === undefined || matched === undefined) continue
              context.report({
                range: [match.index, match.index + matched.length],
                message: "Emoji are not permitted anywhere in the codebase.",
              })
            }
          },
        }
      },
    },
    "kebab-case-filename": {
      create(context): Deno.lint.LintVisitor {
        return {
          Program(node): void {
            const basename = toPosix(context.filename).split("/").pop() ?? ""
            // Kebab-case: lowercase letters/digits, optionally hyphen-separated, optionally
            // dotted suffixes (`.test.ts`, `.d.ts`). Excludes underscores and uppercase.
            if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9]+)*$/.test(basename)) {
              context.report({
                node,
                message:
                  `Filename "${basename}" must be kebab-case ([a-z0-9-]+, dotted suffixes allowed) — no uppercase, no underscores.`,
              })
            }
          },
        }
      },
    },
    "max-file-lines": {
      create(context): Deno.lint.LintVisitor {
        return {
          Program(node): void {
            const lines = lineCount(context.sourceCode.text)
            if (lines > FILE_MAX_LINES) {
              context.report({
                node,
                message:
                  `File has ${lines} lines; hard limit is ${FILE_MAX_LINES}. Split into smaller, single-responsibility modules.`,
              })
            }
          },
        }
      },
    },
    "uk-english": {
      create(context): Deno.lint.LintVisitor {
        if (isTestFile(relPath(context.filename))) return {}
        const flag = (node: Deno.lint.Node | null | undefined): void => {
          if (!node || node.type !== "Identifier") return
          for (const { us, uk } of UK_ENGLISH_OFFENDERS) {
            if (us.test(spelledOut(node.name))) {
              context.report({
                node,
                message: `Identifier "${node.name}" uses US spelling. Use UK spelling ("${uk}" family).`,
              })
              return
            }
          }
        }
        const flagParameter = (parameter: Deno.lint.Parameter): void => {
          if (parameter.type === "Identifier") flag(parameter)
          else if (parameter.type === "AssignmentPattern") flag(parameter.left)
          else if (parameter.type === "RestElement") flag(parameter.argument)
        }
        return {
          VariableDeclarator(node): void {
            flag(node.id.type === "Identifier" ? node.id : null)
          },
          FunctionDeclaration(node): void {
            flag(node.id)
            node.params.forEach(flagParameter)
          },
          FunctionExpression(node): void {
            node.params.forEach(flagParameter)
          },
          ArrowFunctionExpression(node): void {
            node.params.forEach(flagParameter)
          },
          ClassDeclaration(node): void {
            flag(node.id)
          },
          TSInterfaceDeclaration(node): void {
            flag(node.id)
          },
          TSTypeAliasDeclaration(node): void {
            flag(node.id)
          },
          TSPropertySignature(node): void {
            flag(node.key.type === "Identifier" ? node.key : null)
          },
          TSMethodSignature(node): void {
            flag(node.key.type === "Identifier" ? node.key : null)
          },
          PropertyDefinition(node): void {
            flag(node.key.type === "Identifier" ? node.key : null)
          },
          MethodDefinition(node): void {
            flag(node.key.type === "Identifier" ? node.key : null)
          },
        }
      },
    },
  },
}

export default plugin
