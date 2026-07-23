# eslint-plugin-kitbag

The architecture-rule enforcement of SPEC §13.6 — the ESLint successor to
`custom_lint_kitbag`.

## Custom rules (`src/rules/`)

| Rule                                | Enforces                                                                                                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `native-only-in-core-native`        | JSI/TurboModule symbols (`TurboModuleRegistry`, `codegenNative*`, `*HostObject`, `**/jsi/**`, `*Spec`) may be imported only in `core-native` — SPEC §13.2, §9.4. |
| `zustand-create-only-in-core-state` | Zustand store constructors (`create`, `createStore`, `createWithEqualityFn`) may be imported only in `core-state` — SPEC §13.4, §13.6.                           |
| `plugin-api-imports-nothing`        | `core-plugin-api` imports no `@kitbag/*` workspace package — SPEC §13.1, §9.4.                                                                                   |
| `filename-naming-convention`        | `.tsx` component files PascalCase; hooks (`use<X>`) and utils camelCase — SPEC §13.6.                                                                            |

Each rule self-scopes by reading the file's `packages/<name>/` path, so
`plugin.configs.recommended` enables all four globally and each is a no-op
outside the package it guards. The guarded package name is a rule option
(default per table) for testability.

Rules are proven by `@typescript-eslint/rule-tester` with valid **and** failing
invalid cases (`src/rules/*.test.ts`). Run `pnpm --filter eslint-plugin-kitbag test`.

## The import graph (`src/boundaries.ts`)

SPEC §13.6 assigns the full §13.1 import graph to `eslint-plugin-boundaries`.
`boundariesElements` + `boundariesElementTypes` own that graph as data (SPEC
§13.7: one owner). The custom rules above cover the three edges a generic graph
check states weakly (the native holder, the store holder, the contract).

### Wiring pending

Consuming the boundaries graph needs `plugins: { boundaries }` and the settings
in the **root** `eslint.config.mjs` — a shared file this package deliberately
does not edit. That wire-up (import the plugin, spread `boundariesElements` into
`settings['boundaries/elements']`, `boundariesElementTypes` into
`rules['boundaries/element-types']`, and add `...plugin.configs.recommended`) is
a separate step, so the graph is not re-derived at the call site.

Until then the root config keeps its `no-restricted-imports` stopgap for the
import graph; the four custom rules here are the real replacements for the
per-symbol edges and can be wired independently.
