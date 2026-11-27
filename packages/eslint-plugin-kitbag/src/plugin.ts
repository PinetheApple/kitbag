import type { ESLint } from 'eslint';

import { filenameNamingConvention } from './rules/filename-naming-convention.ts';
import { nativeOnlyInCoreNative } from './rules/native-only-in-core-native.ts';
import { noEngineReadToJsThread } from './rules/no-engine-read-to-js-thread.ts';
import { noImportOutsidePackage } from './rules/no-import-outside-package.ts';
import { pluginApiImportsNothing } from './rules/plugin-api-imports-nothing.ts';
import { zustandCreateOnlyInCoreState } from './rules/zustand-create-only-in-core-state.ts';

export const rules = {
  'native-only-in-core-native': nativeOnlyInCoreNative,
  'zustand-create-only-in-core-state': zustandCreateOnlyInCoreState,
  'plugin-api-imports-nothing': pluginApiImportsNothing,
  'filename-naming-convention': filenameNamingConvention,
  'no-import-outside-package': noImportOutsidePackage,
  'no-engine-read-to-js-thread': noEngineReadToJsThread,
};

export const meta = { name: 'eslint-plugin-kitbag', version: '0.0.0' };

// typescript-eslint rules declare readonly defaultOptions, which ESLint's
// Plugin type rejects; one object, so flat config never sees two definitions.
export const kitbagPlugin = { meta, rules } as unknown as ESLint.Plugin;
