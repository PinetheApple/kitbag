// Wired into the workspace root at Phase 2 (SPEC §13/§13.6). Was staged under
// config/ before the RN app existed; see config/README.md for that history.
//
// Invocation (SPEC §13.6 — the `custom_lint --fatal-infos` analogue):
//   pnpm eslint . --max-warnings 0
// Rules below are set to "error" so `--max-warnings 0` is the whole gate.
//
// This is the GENERIC-RULE layer. The real §13.6 enforcement is
// `eslint-plugin-kitbag` + its eval harness, which DOES NOT EXIST YET. Where a
// rule below stands in for that plugin, it is called out as a stopgap.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactNative from 'eslint-plugin-react-native';
import prettier from 'eslint-config-prettier';

// --- §13.7 shared literals ----------------------------------------------------
// Numbers ESLint should not flag as "magic". Kept deliberately tiny: the C++
// side names any number that carries non-obvious intent, and so do we. 0/1/-1
// are structural; 2 covers halving/doubling and index+1 pair work.
const ALLOWED_MAGIC_NUMBERS = [-1, 0, 1, 2];

// Package globs (SPEC §13.1). Phase 2 owns the final layout; if it differs,
// update these globs — the rules key off them.
// `files` globs (which package a rule applies to) — path-based.
const PKG = {
  pluginApi: 'packages/core-plugin-api/**',
  native: 'packages/core-native/**',
  state: 'packages/core-state/**',
  db: 'packages/core-db/**',
  design: 'packages/core-design/**',
  tool: 'packages/tool-*/**',
  shell: 'packages/app-shell/**',
};

// Import specifiers to forbid — workspace package names (SPEC §13.1). Phase 2
// wires cross-package imports by these `@kitbag/*` names (workspace:*), so the
// boundary bans key off them, not the path globs above (which only match a
// literal `packages/...` specifier no one writes). `/*` covers subpath imports
// such as `@kitbag/core-design/waveform`. Still a stopgap: the real import
// graph is owed to eslint-plugin-boundaries (§13.6).
const IMP = {
  pluginApi: ['@kitbag/core-plugin-api', '@kitbag/core-plugin-api/*'],
  native: ['@kitbag/core-native', '@kitbag/core-native/*'],
  state: ['@kitbag/core-state', '@kitbag/core-state/*'],
  db: ['@kitbag/core-db', '@kitbag/core-db/*'],
  design: ['@kitbag/core-design', '@kitbag/core-design/*'],
  tool: ['@kitbag/tool-*'],
  shell: ['@kitbag/app-shell', '@kitbag/app-shell/*'],
};

// Import specifiers that reach the native binding. SPEC §13.2: only
// `core-native` may touch JSI/TurboModules. `TurboModuleRegistry` and the
// codegen entrypoints are the concrete symbols that cross that line.
const NATIVE_ONLY_IMPORTS = {
  paths: [
    {
      name: 'react-native',
      importNames: [
        'TurboModuleRegistry',
        'codegenNativeComponent',
        'codegenNativeCommands',
      ],
      message:
        'JSI/TurboModule access is core-native only (SPEC §13.2, §9.4). ' +
        'Call it through a core-native export.',
    },
  ],
  patterns: [
    {
      // The JSI HostObject install path and generated native specs.
      group: ['**/native/*Spec', '**/*HostObject*', '**/jsi/**'],
      message:
        'The JSI HostObject / native specs live only in core-native ' +
        '(SPEC §13.2). It is the only holder of the kb_engine*.',
    },
  ],
};

// §13.3 stopgap: variable names that read as realtime/60fps truth. A hit means
// the value probably belongs in a SharedValue, not React state. Case-insensitive.
const REALTIME_NAME_RE =
  '/^(beat|beatPosition|barPhase|phase|sweep|needle|bpm|currentBpm|drift|driftNeedle|ledFlash|framesRendered|tunerSnapshot|playerPosition)$/i';

const REALTIME_STATE_MESSAGE =
  '60fps / realtime values never touch React state (SPEC §4.5, §13.3). Read ' +
  'the JSI HostObject in a Reanimated worklet on the UI thread and write a ' +
  'SharedValue. Heuristic stopgap — real check is eslint-plugin-kitbag (§13.6).';

// no-restricted-imports zone builder. Each package gets the set of package
// globs it may NOT import, per SPEC §13.1's "May import" column.
//
// Flat config OVERRIDES (does not merge) a rule's options across config objects
// for the same file, so every non-native package's zone must fold in the native
// binding ban itself (SPEC §13.2) — otherwise this override would clobber it.
// core-native passes `includeNativeBan: false` because it IS the one holder.
function restrictImports(forbidden, clause, { includeNativeBan = true } = {}) {
  const patterns = forbidden.map((group) => ({
    group: [group],
    message: `Import boundary violation (${clause}).`,
  }));
  return [
    'error',
    {
      paths: includeNativeBan ? NATIVE_ONLY_IMPORTS.paths : [],
      patterns: includeNativeBan
        ? [...patterns, ...NATIVE_ONLY_IMPORTS.patterns]
        : patterns,
    },
  ];
}

export default tseslint.config(
  // --- ignores --------------------------------------------------------------
  {
    ignores: [
      '**/node_modules/**',
      '**/build/**',
      '**/dist/**',
      '**/.expo/**',
      // Generated native trees live under packages/app-shell (SPEC §13.8.1).
      '**/android/**',
      '**/ios/**',
      // Tooling config (metro/babel/postcss/prettier/eslint). Not app source;
      // type-aware linting has no tsconfig project for these.
      '**/*.config.{js,cjs,mjs}',
      '**/babel.config.js',
      '**/*.d.ts',
      // Generated: Tailwind theme from core-design tokens (SPEC §13.8.1).
      '**/tailwind.config.*',
      '**/*.gen.ts',
      // Lint-eval fixtures (SPEC §13.6): deliberately rule-violating multi-file
      // trees the harness lints itself. Not workspace source, not in any
      // tsconfig — the root run must skip them.
      '**/eval/scenarios/**',
    ],
  },

  // --- base ------------------------------------------------------------------
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        // Type-aware linting for the whole workspace.
        projectService: true,
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-native': reactNative,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // --- React / hooks ----------------------------------------------------
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules, // no React-in-scope needed
      'react-hooks/rules-of-hooks': 'error',
      // Stale closures over a SharedValue or a poll are how a "human-speed"
      // render drifts from engine truth (SPEC §13.4). Deps are a gate.
      'react-hooks/exhaustive-deps': 'error',

      // --- User rule: no inline handlers in JSX props ------------------------
      // Hard preference: extract to a named handler. Also avoids re-creating a
      // function identity each render, which defeats memo on animated children.
      'react/jsx-no-bind': [
        'error',
        {
          ignoreRefs: false,
          allowArrowFunctions: false,
          allowFunctions: false,
          allowBind: false,
        },
      ],

      // --- User rule: no magic numbers --------------------------------------
      'no-magic-numbers': 'off', // superseded by the TS-aware version below
      '@typescript-eslint/no-magic-numbers': [
        'error',
        {
          ignore: ALLOWED_MAGIC_NUMBERS,
          ignoreEnums: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
          // Allow `const FOO = 300` — naming it IS the fix.
          ignoreDefaultValues: true,
          enforceConst: true,
        },
      ],

      // --- react-native: platform hygiene (lean subset) ---------------------
      'react-native/no-unused-styles': 'error',
      'react-native/no-single-element-style-arrays': 'error',
      // Not enabled: no-inline-styles / no-color-literals — SPEC §13.8.1 puts
      // colour/style authority in core-design tokens + NativeWind, and the
      // token/arbitrary-value ban is owed to eslint-plugin-kitbag (§13.6), not
      // to react-native's heuristics. Turning them on would double-enforce and
      // fight NativeWind's className flow. Left for the real plugin.

      // --- §13.3 STOPGAP: keep 60fps values out of React state --------------
      // HONEST LIMITATION: this is a NAME heuristic, not real enforcement.
      // The real rule (eslint-plugin-kitbag, §13.6, does not exist yet) must
      // understand that a value is realtime because it is polled from the JSI
      // HostObject each frame — a thing no generic AST rule can see. This
      // catches the obvious spelling and nothing else: rename the variable and
      // it goes silent, and it cannot catch the value laundered through an
      // object field or a differently-named hook. Treat a hit as a real bug;
      // do not treat a pass as proof the rule (§13.3) is honoured.
      'no-restricted-syntax': [
        'error',
        {
          // const [beat, setBeat] = useState(...) — flag the state variable.
          selector: `VariableDeclarator[init.callee.name='useState'] > ArrayPattern > Identifier:first-child[name=${REALTIME_NAME_RE}]`,
          message: REALTIME_STATE_MESSAGE,
        },
        {
          // const beatRef = useRef(...) — flag the ref binding.
          selector: `VariableDeclarator[init.callee.name='useRef'][id.name=${REALTIME_NAME_RE}]`,
          message: REALTIME_STATE_MESSAGE,
        },
      ],
    },
  },

  // --- §9.4 / §13.1 boundary zones -----------------------------------------
  // Each override forbids the import groups that package's "May import" row
  // does not list. no-restricted-imports is the cheap stand-in for
  // eslint-plugin-boundaries (SPEC §13.6 names that plugin as the real tool).

  // core-plugin-api — the abstract contract. May import NOTHING (§13.1).
  // Native ban included too: the contract is types only, nothing a plugin
  // carries may enter the core (§9.4).
  {
    files: [PKG.pluginApi],
    rules: {
      'no-restricted-imports': restrictImports(
        [
          PKG.shell,
          PKG.native,
          PKG.state,
          PKG.db,
          PKG.design,
          PKG.tool,
          ...IMP.shell,
          ...IMP.native,
          ...IMP.state,
          ...IMP.db,
          ...IMP.design,
          ...IMP.tool,
        ],
        'SPEC §9.4/§13.1: core-plugin-api imports nothing — it is the ' +
          'contract, and nothing a plugin carries may enter the core',
      ),
    },
  },

  // core-native — the ONLY package that may touch JSI/TurboModules (§13.2).
  // It may import core-plugin-api and nothing else in the graph, so the native
  // ban is NOT applied here (this is the one holder of the kb_engine*).
  {
    files: [PKG.native],
    rules: {
      'no-restricted-imports': restrictImports(
        [
          PKG.shell,
          PKG.state,
          PKG.db,
          PKG.design,
          PKG.tool,
          ...IMP.shell,
          ...IMP.state,
          ...IMP.db,
          ...IMP.design,
          ...IMP.tool,
        ],
        'SPEC §13.1: core-native may import only core-plugin-api',
        { includeNativeBan: false },
      ),
    },
  },

  // core-state — Zustand + concrete DI. May import core-native, core-db,
  // core-plugin-api (§13.1). §13.6: `create()` from zustand belongs here only,
  // but that "one place for stores" rule is owed to eslint-plugin-kitbag; a
  // generic import restriction cannot express "this package MAY, others MAY
  // NOT" for a same-named symbol. Deferred, noted here so it is not forgotten.
  {
    files: [PKG.state],
    rules: {
      'no-restricted-imports': restrictImports(
        [PKG.shell, PKG.tool, ...IMP.shell, ...IMP.tool],
        'SPEC §13.1: core-state may import core-native, core-db, ' +
          'core-plugin-api',
      ),
    },
  },

  // core-db — Drizzle schema/DAOs. May import core-plugin-api only (§13.1).
  {
    files: [PKG.db],
    rules: {
      'no-restricted-imports': restrictImports(
        [
          PKG.shell,
          PKG.native,
          PKG.state,
          PKG.design,
          PKG.tool,
          ...IMP.shell,
          ...IMP.native,
          ...IMP.state,
          ...IMP.design,
          ...IMP.tool,
        ],
        'SPEC §13.1: core-db may import only core-plugin-api',
      ),
    },
  },

  // core-design — tokens, theme, shared components. core-plugin-api only.
  {
    files: [PKG.design],
    rules: {
      'no-restricted-imports': restrictImports(
        [
          PKG.shell,
          PKG.native,
          PKG.state,
          PKG.db,
          PKG.tool,
          ...IMP.shell,
          ...IMP.native,
          ...IMP.state,
          ...IMP.db,
          ...IMP.tool,
        ],
        'SPEC §13.1: core-design may import only core-plugin-api',
      ),
    },
  },

  // tool-* — plugins. May import core-*, NEVER each other, NEVER app-shell.
  {
    files: [PKG.tool],
    rules: {
      'no-restricted-imports': restrictImports(
        [PKG.shell, PKG.tool, ...IMP.shell, ...IMP.tool],
        'SPEC §9.4/§13.1: a tool may import core-* only — never another ' +
          'tool, never app-shell',
      ),
    },
  },

  // app-shell — may import everything (§13.1), but is NOT core-native, so the
  // native binding ban still applies: even the shell reaches the engine only
  // through a core-native export (§13.2).
  {
    files: [PKG.shell],
    rules: {
      'no-restricted-imports': restrictImports(
        [],
        'SPEC §13.2: app-shell reaches the engine only through core-native',
      ),
    },
  },

  // --- config / test relaxations -------------------------------------------
  {
    files: ['**/*.config.{ts,mjs,js}', '**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
    },
  },

  // Prettier last: turn off rules that fight the formatter.
  prettier,
);
