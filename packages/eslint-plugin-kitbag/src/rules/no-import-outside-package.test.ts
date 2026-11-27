import { RuleTester } from '@typescript-eslint/rule-tester';

import { noImportOutsidePackage } from './no-import-outside-package.ts';

const ruleTester = new RuleTester();

const TOOL = '/repo/packages/tool-drill/src/screen/useDrill.ts';

ruleTester.run('no-import-outside-package', noImportOutsidePackage, {
  valid: [
    { code: "import { tempo } from './tempo';", filename: TOOL },
    { code: "import { drill } from '../../drill';", filename: TOOL },
    { code: "export * from '../logic/steps';", filename: TOOL },
    { code: "import { View } from 'react-native';", filename: TOOL },
  ],
  invalid: [
    {
      code: "import { tuner } from '../../../tool-tuner/src/index';",
      filename: TOOL,
      errors: [{ messageId: 'outsidePackage' }],
    },
    {
      code: "export { store } from '../../../core-state/src/store';",
      filename: TOOL,
      errors: [{ messageId: 'outsidePackage' }],
    },
    {
      code: "import { name } from '../../package.json/../../tool-drill-extra/x';",
      filename: TOOL,
      errors: [{ messageId: 'outsidePackage' }],
    },
  ],
});
