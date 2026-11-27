import { filenameNamingConvention } from './rules/filename-naming-convention';
import { nativeOnlyInCoreNative } from './rules/native-only-in-core-native';
import { noStateWritesInFrameCallback } from './rules/no-state-writes-in-frame-callback';
import { pluginApiImportsNothing } from './rules/plugin-api-imports-nothing';
import { zustandCreateOnlyInCoreState } from './rules/zustand-create-only-in-core-state';

const rules = {
  'native-only-in-core-native': nativeOnlyInCoreNative,
  'zustand-create-only-in-core-state': zustandCreateOnlyInCoreState,
  'plugin-api-imports-nothing': pluginApiImportsNothing,
  'filename-naming-convention': filenameNamingConvention,
  'no-state-writes-in-frame-callback': noStateWritesInFrameCallback,
};

const meta = { name: 'eslint-plugin-kitbag', version: '0.0.0' };

interface RecommendedConfig {
  plugins: { kitbag: { meta: typeof meta; rules: typeof rules } };
  rules: Record<string, 'error'>;
}

// The package-scoped rules are no-ops outside the package they guard, so one
// config enabling every rule everywhere is correct.
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
      'kitbag/no-state-writes-in-frame-callback': 'error',
    },
  },
];

export { boundariesElements, boundariesElementTypes } from './boundaries';

export default plugin;
