# @innis/coding-standards

[![CI](https://github.com/johninnis/coding-standards-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/johninnis/coding-standards-ts/actions/workflows/ci.yml)

> These rules encode the conventions of the **Innis ecosystem**. They are deliberately opinionated and almost certainly not to everyone's taste — that is by design. They are published for anyone extending the Innis libraries, or who simply wants to hold their own code to the same standards.

Deno lint rules and CI check scripts that enforce the Innis coding conventions mechanically, inside the `deno lint` run and CI gate every package already has. Because the rules run on the real AST and the scripts resolve the public surface through `deno doc` from the repository's own `exports`, re-export barrels, multi-entry packages and type-only exports are all handled correctly. Shipping the gate as one package means a rule change is a version bump in every repository instead of a file copied into each.

It is the TypeScript sibling of [`innis/coding-standards`](https://github.com/johninnis/coding-standards), which enforces the same conventions for PHP through PHPStan.

## Installation

There is nothing to install — Deno resolves the package straight from JSR. Point the repository's deno.json at it: the plugin in `lint.plugins`, the scripts as tasks:

```json
{
  "lint": {
    "plugins": ["jsr:@innis/coding-standards@^0.2.0/lint-plugin"]
  },
  "tasks": {
    "coverage": "rm -rf cov_profile && deno test -A --coverage=cov_profile && deno coverage cov_profile --lcov --output=cov_profile/lcov.info && deno coverage cov_profile && deno run --allow-read jsr:@innis/coding-standards@^0.2.0/check-coverage",
    "exports-tested": "deno run --allow-read --allow-run jsr:@innis/coding-standards@^0.2.0/check-exports-tested",
    "docs": "deno run --allow-read --allow-run jsr:@innis/coding-standards@^0.2.0/check-docs",
    "lint-exemptions": "deno run --allow-read --allow-run jsr:@innis/coding-standards@^0.2.0/check-lint-exemptions"
  }
}
```

Requires Deno 2.2 or later — the lint plugin API arrived in 2.2. The layer and path rules resolve filenames against the directory `deno lint` runs from, so run it from the repository root — which is where Deno runs configured tasks anyway.

## What it enforces

Every rule reports under the plugin's `innis/` namespace, so a finding reads `innis/no-emoji` and a suppression can target exactly one rule.

| Identifier | What it flags |
| --- | --- |
| `innis/no-type-assertions` | An `as` or angle-bracket type assertion (other than `as const`) — it bypasses the type checker; use a type guard, narrow the value, or fix the upstream type. |
| `innis/no-layer-violation` | A relative import — static or dynamic `import()` — that points outward against clean-architecture layering: `src/domain/` importing from `src/application/`, `src/infrastructure/` or `src/presentation/`; `src/application/` from `src/infrastructure/` or `src/presentation/`; or either outer layer, `src/infrastructure/` or `src/presentation/`, from the other. Both outer layers depend inward only, and a composition root outside the layer folders wires them together. Files under no layer directory are unlayered and exempt. |
| `innis/no-catch-in-layer` | A `catch` clause or a `.catch(...)` call in `src/domain/` or `src/application/` — a fault bubbles to the edges or the function returns a Result; only Infrastructure and Presentation handle. Two forms are permitted: the edge conversion `try { return call() } catch { return failure }` — a try of one `return`, a catch of one `return` with a value, no `finally` — which turns one call's refusal into a returned failure where its input enters (a parser with no non-throwing form, such as `JSON.parse`); and a detached promise handing its fault to a sink passed by reference, `promise.catch(deps.onError)`, never to an inline handler. |
| `innis/max-params` | A function with more than three parameters — a design signal to decompose the unit. |
| `innis/no-emoji` | An emoji anywhere in a source file (code, comment, or string). |
| `innis/kebab-case-filename` | A filename that is not kebab-case — no uppercase, no underscores; dotted suffixes such as `.test.ts` are allowed. |
| `innis/max-file-lines` | A file over five hundred lines — split it into smaller, single-responsibility modules. |
| `innis/uk-english` | A US spelling in a declared identifier (variable, function, parameter, class, interface, type alias, property or method name), matched word-by-word so camelCase compounds such as `backgroundColor` are caught; string values are left alone. |

Two rules relax in test code: `no-emoji` and `uk-english` skip test files (`*.test.ts` anywhere, and everything under `tests/`).

A repository that adds lint rules of its own can build on the same path and layer helpers the plugin uses, from the `/lint-helpers` export: `relPath`, `layerOf`, `isTestFile`, `importSourceVisitor` and `relativeImportVisitor`.

The check scripts gate what a linter cannot see — each is a CLI export that exits non-zero on a violation:

| Export | What it gates |
| --- | --- |
| `/check-docs` | Every public export reachable from an entry point has a JSDoc comment. Entry points are read from the repository's own `exports` (deno.json, deno.jsonc or jsr.json) and re-export barrels are resolved, so the gated surface is the same one JSR scores. |
| `/check-exports-tested` | Every public runtime export (function, class, variable — type-only exports have no runtime to exercise) has at least one word-boundary reference in `tests/`. Protocol-defined constants whose only possible test would restate their value are exempted by pattern: `--exempt '^KIND_'`. |
| `/check-coverage` | The summed lcov line coverage in `cov_profile/lcov.info` meets the eighty percent floor. |
| `/check-lint-exemptions` | Every lint exemption in the `lint` task still matches something. Each `deno lint` pass that excludes rules is re-run with every rule on, and each excluded rule must still fire in every file the pass names (in at least one file under a directory it names). Run it after `lint` in `ci`. |
| `/check-path-lengths` | No tracked path (`git ls-files`) holds a component longer than 95 characters, the longest JSR accepts. `deno publish --dry-run` does not check this, so a long filename (an ADR's, typically) otherwise fails only the real publish. Needs `--allow-run=git`. |

## Deliberate departures

A departure lives in the package's own committed `deno.json` lint task, never inline, with a one-line justification comment above it — a `Deliberate: …` note or an `ADR-NNNN` reference. Do not use `// deno-lint-ignore` comments. The config ships with the package, so the comment travels with the exemption, and the exemption is removed once nothing triggers it — `/check-lint-exemptions` fails CI on one that matches nothing.

An exemption is acceptable for a type-system false positive no narrowing can express (`no-type-assertions` on a value already checked); for test-only code, a test double of a host type the runtime cannot construct; and for `no-console` in a script or example whose output is the console. A design rule (`no-catch-in-layer`, `no-layer-violation`, `max-params`, `max-file-lines`) is never exempted: change the code, or the rule.

The task lints in two passes: the first lints everything except the exempt files, the second lints only those files with the rule excluded, so every other rule still applies to them:

```jsonc
{
  "tasks": {
    // Deliberate: the test relay narrows wire filters it has already checked are records — see ADR-NNNN
    "lint": "deno lint --ignore=testing.ts && deno lint --rules-exclude=innis/no-type-assertions testing.ts"
  },
  "lint": {
    "include": ["mod.ts", "testing.ts", "src/", "tests/"],
    "exclude": ["cov_profile/"]
  }
}
```

Give the first pass no path arguments and scope it with `lint.include` / `lint.exclude` in config instead: in Deno 2.9.5, `--ignore` applies only under the first path argument, so `deno lint --ignore=src/a.ts,tests/b.ts src/ tests/` still lints `tests/b.ts` with every rule on.

To turn a rule off for the whole package rather than for named files, exclude its identifier in the same config, with the same justification comment:

```jsonc
{
  "lint": {
    "rules": { "exclude": ["innis/uk-english"] }
  }
}
```

## Development

```sh
deno task ci             # the full gate: fmt:check, lint, lint-exemptions, check, coverage, exports-tested, docs, path-lengths
deno task test           # unit tests only
deno task coverage       # tests + the line-coverage floor
deno task publish:dry    # verify the JSR publish surface
```

The package gates itself with its own plugin and scripts, run from local paths.
