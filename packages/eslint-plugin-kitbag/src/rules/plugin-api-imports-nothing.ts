import type { TSESTree } from '@typescript-eslint/utils';

import { createRule } from '../utils/create-rule.ts';
import { isInPackage } from '../utils/package-path.ts';

const KITBAG_WORKSPACE_PREFIX = '@kitbag/';

// SPEC §9.1 lets type-only imports of these type the listening slice; runtime imports stay banned.
const TYPE_ONLY_EXTERNAL = new Set(['react', 'react-native-reanimated']);

const FORBIDDEN_EXTERNAL = new Set([
  'react',
  'react-native',
  'react-native-reanimated',
  'react-native-gesture-handler',
]);

// Native/JSI/TurboModule specifiers: only core-native may touch these (§13.1).
function isNativeSpecifier(source: string): boolean {
  return (
    source.startsWith('react-native/') ||
    source.includes('TurboModule') ||
    source.includes('turbo-module') ||
    /\bjsi\b/i.test(source)
  );
}

type Options = readonly [{ package?: string }?];
type MessageIds = 'forbiddenImport';

export const pluginApiImportsNothing = createRule<Options, MessageIds>({
  name: 'plugin-api-imports-nothing',
  meta: {
    defaultOptions: [{}],
    type: 'problem',
    docs: {
      description:
        'core-plugin-api imports nothing from the workspace (SPEC §13.1).',
    },
    schema: [
      {
        type: 'object',
        properties: { package: { type: 'string' } },
        additionalProperties: false,
      },
    ],
    messages: {
      forbiddenImport:
        "core-plugin-api must not import '{{source}}' — it is the contract " +
        'and imports nothing: no React, no store, no native module ' +
        '(SPEC §9.1, §13.1, §9.4). If the contract needs one, the contract is ' +
        'wrong.',
    },
  },
  create(context, [options]) {
    const guardedPackage = options?.package ?? 'core-plugin-api';
    if (!isInPackage(context.filename, guardedPackage)) {
      return {};
    }

    return {
      ImportDeclaration(node: TSESTree.ImportDeclaration) {
        const source = node.source.value;
        const typeOnly =
          node.importKind === 'type' && TYPE_ONLY_EXTERNAL.has(source);
        const forbidden =
          source.startsWith(KITBAG_WORKSPACE_PREFIX) ||
          (FORBIDDEN_EXTERNAL.has(source) && !typeOnly) ||
          isNativeSpecifier(source);
        if (forbidden) {
          context.report({
            node: node.source,
            messageId: 'forbiddenImport',
            data: { source },
          });
        }
      },
    };
  },
});
