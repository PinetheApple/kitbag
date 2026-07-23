import type { TSESTree } from '@typescript-eslint/utils';

import { createRule } from '../utils/create-rule';
import { isInPackage } from '../utils/package-path';

// SPEC §13.1 / §9.4 / §13.6: core-plugin-api is the abstract contract and
// imports NOTHING from the rest of the workspace — nothing a plugin carries may
// enter the core. This rule bans every `@kitbag/*` workspace import inside it
// (which subsumes §13.6's narrower "must not import app-shell or tool_*").

const KITBAG_WORKSPACE_PREFIX = '@kitbag/';

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
        'and imports nothing (SPEC §13.1, §9.4). Nothing a plugin carries may ' +
        'enter the core.',
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
        if (source.startsWith(KITBAG_WORKSPACE_PREFIX)) {
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
