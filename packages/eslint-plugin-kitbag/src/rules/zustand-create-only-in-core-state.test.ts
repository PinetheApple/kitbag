import { RuleTester } from '@typescript-eslint/rule-tester';

import { zustandCreateOnlyInCoreState } from './zustand-create-only-in-core-state';

const ruleTester = new RuleTester();

const CORE_STATE = '/repo/packages/core-state/src/metronome-store.ts';
const TOOL = '/repo/packages/tool-metronome/src/store.ts';
const DESIGN = '/repo/packages/core-design/src/theme.ts';

ruleTester.run(
  'zustand-create-only-in-core-state',
  zustandCreateOnlyInCoreState,
  {
    valid: [
      // Stores live here.
      {
        code: "import { create } from 'zustand';",
        filename: CORE_STATE,
      },
      {
        code: "import { createStore } from 'zustand/vanilla';",
        filename: CORE_STATE,
      },
      // A non-factory import from zustand is fine anywhere (types, hooks).
      {
        code: "import { useStore } from 'zustand';",
        filename: TOOL,
      },
    ],
    invalid: [
      // A tool spinning up its own store — bites.
      {
        code: "import { create } from 'zustand';",
        filename: TOOL,
        errors: [{ messageId: 'storeFactory' }],
      },
      // core-design keeping a shadow store — bites.
      {
        code: "import { createWithEqualityFn } from 'zustand/react';",
        filename: DESIGN,
        errors: [{ messageId: 'storeFactory' }],
      },
    ],
  },
);
