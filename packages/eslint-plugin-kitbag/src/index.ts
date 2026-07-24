// eslint-plugin-kitbag — the architecture-rule enforcement of SPEC §13.6.
//
// Four custom AST rules, each mapping to a §9.4/§13.1 boundary:
//   native-only-in-core-native        — JSI/TurboModule only in core-native (§13.2)
//   zustand-create-only-in-core-state — Zustand stores only in core-state (§13.4)
//   plugin-api-imports-nothing        — the contract imports nothing (§13.1)
//   filename-naming-convention        — PascalCase components, camelCase hooks/utils (§13.6)
//
// The remaining import edges of §13.1 are owned by eslint-plugin-boundaries;
// see ./boundaries for the graph data and README for the (root-config) wire-up.

import { filenameNamingConvention } from './rules/filename-naming-convention';
import { nativeOnlyInCoreNative } from './rules/native-only-in-core-native';
import { pluginApiImportsNothing } from './rules/plugin-api-imports-nothing';
import { zustandCreateOnlyInCoreState } from './rules/zustand-create-only-in-core-state';

const rules = {
  'native-only-in-core-native': nativeOnlyInCoreNative,
  'zustand-create-only-in-core-state': zustandCreateOnlyInCoreState,
  'plugin-api-imports-nothing': pluginApiImportsNothing,
  'filename-naming-convention': filenameNamingConvention,
};

const meta = { name: 'eslint-plugin-kitbag', version: '0.0.0' };

interface RecommendedConfig {
  plugins: { kitbag: { meta: typeof meta; rules: typeof rules } };
  rules: Record<string, 'error'>;
}

// Each custom rule self-scopes by reading the file's package path, so one flat
// config object that enables all four everywhere is correct: a rule is a no-op
// outside the package it guards.
const plugin = {
  meta,
  rules,
  configs: {} as { recommended: RecommendedConfig[] },
};

plugin.configs.recommended = [
  {
    plugins: { kitbag: { meta, rules } },
    rules: {
      'kitbag/native-only-in-core-native': 'error',
      'kitbag/zustand-create-only-in-core-state': 'error',
      'kitbag/plugin-api-imports-nothing': 'error',
      'kitbag/filename-naming-convention': 'error',
    },
  },
];

export { boundariesElements, boundariesElementTypes } from './boundaries';

export default plugin;
