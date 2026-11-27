# eslint-plugin-kitbag

The architecture-rule enforcement of SPEC §13.6 — the ESLint successor to
`custom_lint_kitbag`.

## Custom rules (`src/rules/`)

Package rules, enabled everywhere by `plugin.configs.recommended`. Each reads
the file's `packages/<name>/` path and is a no-op outside the package it
guards; the guarded package name is a rule option for testability.

| Rule | Enforces |
| --- | --- |
| `native-only-in-core-native` | JSI/TurboModule symbols (`TurboModuleRegistry`, `codegenNative*`, `*HostObject`, `**/jsi/**`, `*Spec`) may be imported only in `core-native` — SPEC §13.2, §9.4. |
| `zustand-create-only-in-core-state` | Zustand store constructors (`create`, `createStore`, `createWithEqualityFn`) may be imported only in `core-state` — SPEC §13.4, §13.6. |
| `plugin-api-imports-nothing` | `core-plugin-api` imports no `@kitbag/*` workspace package — SPEC §13.1, §9.4. |
| `filename-naming-convention` | `.tsx` component files PascalCase; hooks (`use<X>`) and utils camelCase — SPEC §13.6. |

Downloadable-zone rules, enabled only by `downloadableZoneConfig(files)`:

| Rule | Enforces |
| --- | --- |
| `no-import-outside-package` | A relative import resolves inside the file's own `packages/<name>/` directory — SPEC §13.1. |
| `no-engine-read-to-js-thread` | A UI-thread callback (`'worklet'` function, `useFrameCallback`, `useAnimatedReaction`, `useDerivedValue`, `useAnimatedStyle`, `useAnimatedProps`, `Gesture` callbacks) never passes a value derived from a `host.engine.reads` call to `scheduleOnRN`, `runOnJS`, a `useState` setter or a store's `setState` — SPEC §13.3, §13.4. |

Rules are proven by `@typescript-eslint/rule-tester` with valid **and** failing
invalid cases (`src/rules/*.test.ts`). Run `pnpm --filter eslint-plugin-kitbag test`.

## The downloadable zone (`src/downloadableZone.ts`)

A package whose `package.json` has `"kitbag": { "downloadable": true }` is in
the zone. `downloadableZoneConfig(files, base)` builds its one config object:
imports limited to the delivery allowlist and a curated `react-native`, no
`require` or `import()`, and the two zone rules above. `base` carries the
caller's own `no-restricted-imports` and `no-restricted-syntax` entries, since
the zone's options replace them for its files. The root `eslint.config.mjs`
and the eval harness both call it, so the zone is enforced in `pnpm -w lint`
for marked packages; no workspace package is marked yet.

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
a separate step, so the graph is not re-derived at the call site. The root
already loads this package's `src/index.ts` for the downloadable zone.

Until then the root config keeps its `no-restricted-imports` stopgap for the
import graph; the four package rules here are the real replacements for the
per-symbol edges and can be wired independently.
