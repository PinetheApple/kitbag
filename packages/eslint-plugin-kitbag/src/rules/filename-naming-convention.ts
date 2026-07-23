import type { TSESTree } from '@typescript-eslint/utils';

import { createRule } from '../utils/create-rule';
import { basename } from '../utils/package-path';

// SPEC §13.6, last rule (PascalCase filenames + class names, translated):
//   - component files (`.tsx`)      → PascalCase   (e.g. BeatSweep.tsx)
//   - hooks (`use<X>.ts`)           → camelCase, already satisfied by `use…`
//   - everything else (`.ts` util)  → camelCase    (e.g. barPhase.ts)
//
// Filename-driven, so it fires on `Program` and reads `context.filename`.

const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;
const CAMEL_CASE = /^[a-z][A-Za-z0-9]*$/;
const HOOK_NAME = /^use[A-Z0-9]/;

type MessageIds = 'component' | 'util';

export const filenameNamingConvention = createRule<[], MessageIds>({
  name: 'filename-naming-convention',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Component files are PascalCase; hooks and utils are camelCase (SPEC §13.6).',
    },
    schema: [],
    messages: {
      component:
        "Component file '{{name}}' must be PascalCase (SPEC §13.6), e.g. 'BeatSweep.tsx'.",
      util: "Hook/util file '{{name}}' must be camelCase (SPEC §13.6), e.g. 'barPhase.ts' or 'useTempo.ts'.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      Program(node: TSESTree.Program) {
        const file = basename(context.filename);

        // `<stdin>` and virtual filenames have no bearing here.
        if (!file.includes('.')) {
          return;
        }

        const isTsx = file.endsWith('.tsx');
        const stem = file.replace(/\.tsx?$/, '');

        // Ignore multi-segment names: index, tests, decls, generated, configs.
        // Their conventions are fixed by tooling, not by this rule.
        if (stem === 'index' || stem.includes('.')) {
          return;
        }

        if (isTsx) {
          if (!PASCAL_CASE.test(stem)) {
            context.report({
              node,
              messageId: 'component',
              data: { name: file },
            });
          }
          return;
        }

        // `.ts`: a hook (`use<X>`) is camelCase by construction; otherwise the
        // stem must itself be camelCase.
        if (!HOOK_NAME.test(stem) && !CAMEL_CASE.test(stem)) {
          context.report({ node, messageId: 'util', data: { name: file } });
        }
      },
    };
  },
});
