import { RuleTester } from '@typescript-eslint/rule-tester';

import { pluginApiImportsNothing } from './plugin-api-imports-nothing';

const ruleTester = new RuleTester();

const PLUGIN_API = '/repo/packages/core-plugin-api/src/contract.ts';
const STATE = '/repo/packages/core-state/src/store.ts';

ruleTester.run('plugin-api-imports-nothing', pluginApiImportsNothing, {
  valid: [
    // Relative imports within the contract package are fine — pure TS only.
    {
      code: "import type { RouteDescriptor } from './route';",
      filename: PLUGIN_API,
    },
    // A file with no imports at all is trivially clean.
    { code: 'export type IconName = string;', filename: PLUGIN_API },
    // The rule only guards core-plugin-api: core-state may import core-native
    // and may import react.
    { code: "import { start } from '@kitbag/core-native';", filename: STATE },
    { code: "import type { ReactNode } from 'react';", filename: STATE },
  ],
  invalid: [
    // The contract reaching into a concrete package — bites (§13.1).
    {
      code: "import { start } from '@kitbag/core-native';",
      filename: PLUGIN_API,
      errors: [{ messageId: 'forbiddenImport' }],
    },
    {
      code: "import { MetronomeTool } from '@kitbag/tool-metronome';",
      filename: PLUGIN_API,
      errors: [{ messageId: 'forbiddenImport' }],
    },
    // §9.1: "No React import." Even a type-only react import is a violation —
    // PluginScreen is React-agnostic so the contract needs none.
    {
      code: "import type { ReactNode } from 'react';",
      filename: PLUGIN_API,
      errors: [{ messageId: 'forbiddenImport' }],
    },
    // §9.1: "No native import." react-native and the JSI/TurboModule boundary
    // belong to core-native alone (§13.1).
    {
      code: "import { View } from 'react-native';",
      filename: PLUGIN_API,
      errors: [{ messageId: 'forbiddenImport' }],
    },
    {
      code: "import { TurboModuleRegistry } from 'react-native';",
      filename: PLUGIN_API,
      errors: [{ messageId: 'forbiddenImport' }],
    },
  ],
});
