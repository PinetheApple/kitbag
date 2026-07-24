import { RuleTester } from '@typescript-eslint/rule-tester';

import { filenameNamingConvention } from './filename-naming-convention';

const ruleTester = new RuleTester();

const CODE = 'export const marker = true;';
const dir = '/repo/packages/core-design/src/';

ruleTester.run('filename-naming-convention', filenameNamingConvention, {
  valid: [
    // Component file, PascalCase.
    { code: CODE, filename: `${dir}BeatSweep.tsx` },
    // Hook file, use<X> camelCase.
    { code: CODE, filename: `${dir}useTempo.ts` },
    // Util file, camelCase.
    { code: CODE, filename: `${dir}barPhase.ts` },
    // Tooling-fixed names are ignored.
    { code: CODE, filename: `${dir}index.ts` },
    { code: CODE, filename: `${dir}barPhase.test.ts` },
    { code: CODE, filename: `${dir}engine.gen.ts` },
  ],
  invalid: [
    // A component file that is not PascalCase — bites.
    {
      code: CODE,
      filename: `${dir}beatSweep.tsx`,
      errors: [{ messageId: 'component' }],
    },
    // A util file that is PascalCase (not a hook) — bites.
    {
      code: CODE,
      filename: `${dir}TempoUtils.ts`,
      errors: [{ messageId: 'util' }],
    },
    // A util file in snake_case — bites.
    {
      code: CODE,
      filename: `${dir}bar_phase.ts`,
      errors: [{ messageId: 'util' }],
    },
  ],
});
