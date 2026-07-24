import type { TSESTree } from '@typescript-eslint/utils';

import { createRule } from '../utils/create-rule';
import { isInPackage } from '../utils/package-path';

// SPEC §9.1 / §13.1 / §9.4 / §13.6: core-plugin-api is the abstract contract and
// imports NOTHING — "No React import, no store import, no native import" (§9.1).
// It bans every `@kitbag/*` workspace import inside it (which subsumes §13.6's
// narrower "must not import app-shell or tool_*"), and also the three external
// edges §9.1 names by hand: react / react-native and any native/JSI/TurboModule
// specifier. Only pure TypeScript (types, relative self-imports) is allowed.

const KITBAG_WORKSPACE_PREFIX = '@kitbag/';

// The external specifiers §9.1 forbids by name. `react`/`react-native` are the
// framework edges (PluginScreen is React-agnostic precisely so none is needed);
// the rest are the native boundary that only core-native may cross (§13.1).
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
  defaultOptions: [{}],
  create(context, [options]) {
    const guardedPackage = options?.package ?? 'core-plugin-api';
    if (!isInPackage(context.filename, guardedPackage)) {
      return {};
    }

    return {
      ImportDeclaration(node: TSESTree.ImportDeclaration) {
        const source = node.source.value;
        const forbidden =
          source.startsWith(KITBAG_WORKSPACE_PREFIX) ||
          FORBIDDEN_EXTERNAL.has(source) ||
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
