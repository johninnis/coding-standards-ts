# @innis/coding-standards

[![CI](https://github.com/johninnis/coding-standards-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/johninnis/coding-standards-ts/actions/workflows/ci.yml)

> These rules encode the conventions of the **Innis ecosystem**. They are deliberately opinionated and
> almost certainly not to everyone's taste — that is by design. They are published for anyone extending
> the Innis libraries, or who simply wants to hold their own code to the same standards.

Deno lint rules and CI check scripts that enforce the Innis coding conventions mechanically, inside
the `deno lint` run and CI gate every package already has. Because the rules run on the real AST and
the scripts resolve the public surface through `deno doc` from the repository's own `exports`,
re-export barrels, multi-entry packages and type-only exports are all handled correctly. Shipping
the gate as one package means a rule change is a version bump in every repository instead of a file
copied into each.

It is the TypeScript sibling of [`innis/coding-standards`](https://github.com/johninnis/coding-standards),
which enforces the same conventions for PHP through PHPStan.

## Installation

There is nothing to install — Deno resolves the package straight from JSR. Point the repository's
deno.json at it: the plugin in `lint.plugins`, the scripts as tasks:

```json
{
  "lint": {
    "plugins": ["jsr:@innis/coding-standards@^0.1.0/lint-plugin"]
  },
  "tasks": {
    "coverage": "rm -rf cov_profile && deno test -A --coverage=cov_profile && deno coverage cov_profile --lcov --output=cov_profile/lcov.info && deno coverage cov_profile && deno run --allow-read jsr:@innis/coding-standards@^0.1.0/check-coverage",
    "exports-tested": "deno run --allow-read --allow-run jsr:@innis/coding-standards@^0.1.0/check-exports-tested",
    "docs": "deno run --allow-read --allow-run jsr:@innis/coding-standards@^0.1.0/check-docs"
  }
}
```

Requires Deno 2.2 or later — the lint plugin API arrived in 2.2. The layer and path rules resolve filenames against the directory `deno lint` runs
from, so run it from the repository root — which is where Deno runs configured tasks anyway.

## What it enforces

Every rule reports under the plugin's `innis/` namespace, so a finding reads `innis/no-emoji` and a
suppression can target exactly one rule.

| Identifier | What it flags |
| --- | --- |
| `innis/no-type-assertions` | An `as` or angle-bracket type assertion (other than `as const`) — it bypasses the type checker; use a type guard, narrow the value, or fix the upstream type. |
| `innis/no-layer-violation` | A relative import — static or dynamic `import()` — that points outward against clean-architecture layering: `src/domain/` importing from `src/application/` or `src/infrastructure/`, or `src/application/` from `src/infrastructure/`. Files under no layer directory are unlayered and exempt. |
| `innis/no-catch-in-layer` | A `catch` clause or a `.catch(...)` call in `src/domain/` or `src/application/` — a fault bubbles to the edges or the function returns a Result; only Infrastructure and Presentation handle. |
| `innis/max-params` | A function with more than three parameters — a design signal to decompose the unit. |
| `innis/no-emoji` | An emoji anywhere in a source file (code, comment, or string). |
| `innis/kebab-case-filename` | A filename that is not kebab-case — no uppercase, no underscores; dotted suffixes such as `.test.ts` are allowed. |
| `innis/max-file-lines` | A file over five hundred lines — split it into smaller, single-responsibility modules. |
| `innis/uk-english` | A US spelling in a declared identifier (variable, function, parameter, class, interface, type alias, property or method name), matched word-by-word so camelCase compounds such as `backgroundColor` are caught; string values are left alone. |

Two rules relax in test code: `no-emoji` and `uk-english` skip test files (`*.test.ts` anywhere, and
everything under `tests/`).

The check scripts gate what a linter cannot see — each is a CLI export that exits non-zero on a
violation:

| Export | What it gates |
| --- | --- |
| `/check-docs` | Every public export reachable from an entry point has a JSDoc comment. Entry points are read from the repository's own `exports` (deno.json, deno.jsonc or jsr.json) and re-export barrels are resolved, so the gated surface is the same one JSR scores. |
| `/check-exports-tested` | Every public runtime export (function, class, variable — type-only exports have no runtime to exercise) has at least one word-boundary reference in `tests/`. Protocol-defined constants whose only possible test would restate their value are exempted by pattern: `--exempt '^KIND_'`. |
| `/check-coverage` | The summed lcov line coverage in `cov_profile/lcov.info` meets the eighty percent floor. |

## Deliberate departures

A justified departure honours the ecosystem's Chesterton's-Fence convention: silence the rule at the
exact site with deno lint's native comment, and pin the reason — a `Deliberate: …` note or an
`ADR-NNNN` reference — beside it so the fence explains itself:

```ts
// deno-lint-ignore innis/max-params -- Deliberate: the wire format dictates the shape
```

The comment is scoped to the statement it sits on — a fence on one function silences that function,
not its siblings. To silence a rule project-wide (rather than a single site), exclude its identifier
in deno.json:

```json
{
  "lint": {
    "rules": { "exclude": ["innis/uk-english"] }
  }
}
```

Prefer the site-pinned fence over a project-wide exclude for a genuine one-off exception.

## Development

```sh
deno task ci             # the full gate: fmt:check, lint, check, coverage, exports-tested, docs
deno task test           # unit tests only
deno task coverage       # tests + the line-coverage floor
deno task publish:dry    # verify the JSR publish surface
```

The package gates itself with its own plugin and scripts, run from local paths.
