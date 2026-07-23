import { RuleTester } from '@typescript-eslint/rule-tester';

import { nativeOnlyInCoreNative } from './native-only-in-core-native';

const ruleTester = new RuleTester();

const CORE_NATIVE = '/repo/packages/core-native/src/engine.ts';
const TOOL = '/repo/packages/tool-metronome/src/screen.tsx';
const STATE = '/repo/packages/core-state/src/store.ts';

ruleTester.run('native-only-in-core-native', nativeOnlyInCoreNative, {
  valid: [
    // The one holder: TurboModule + HostObject imports are fine here.
    {
      code: "import { TurboModuleRegistry } from 'react-native';",
      filename: CORE_NATIVE,
    },
    {
      code: "import { install } from './KbEngineHostObject';",
      filename: CORE_NATIVE,
    },
    // Ordinary react-native imports are fine anywhere.
    { code: "import { View } from 'react-native';", filename: TOOL },
    // The sanctioned boundary: reaching the engine through a core-native export.
    { code: "import { start } from '@kitbag/core-native';", filename: STATE },
  ],
  invalid: [
    // A tool importing a TurboModule symbol — bites.
    {
      code: "import { TurboModuleRegistry } from 'react-native';",
      filename: TOOL,
      errors: [{ messageId: 'nativeSymbol' }],
    },
    {
      code: "import { codegenNativeComponent } from 'react-native';",
      filename: STATE,
      errors: [{ messageId: 'nativeSymbol' }],
    },
    // A state package importing the JSI HostObject — bites.
    {
      code: "import { install } from '../jsi/install';",
      filename: STATE,
      errors: [{ messageId: 'hostObject' }],
    },
    {
      code: "import Spec from './NativeMetronomeSpec';",
      filename: TOOL,
      errors: [{ messageId: 'hostObject' }],
    },
  ],
});
