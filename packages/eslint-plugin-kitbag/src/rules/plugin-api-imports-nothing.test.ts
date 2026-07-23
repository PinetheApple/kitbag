import { RuleTester } from '@typescript-eslint/rule-tester';

import { pluginApiImportsNothing } from './plugin-api-imports-nothing';

const ruleTester = new RuleTester();

const PLUGIN_API = '/repo/packages/core-plugin-api/src/contract.ts';
const STATE = '/repo/packages/core-state/src/store.ts';

ruleTester.run('plugin-api-imports-nothing', pluginApiImportsNothing, {
  valid: [
    // Relative imports within the contract package are fine.
    {
      code: "import type { RouteDescriptor } from './route';",
      filename: PLUGIN_API,
    },
    // Third-party type-only imports are not workspace edges.
    { code: "import type { ReactNode } from 'react';", filename: PLUGIN_API },
    // The rule only guards core-plugin-api: core-state may import core-native.
    { code: "import { start } from '@kitbag/core-native';", filename: STATE },
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
  ],
});
