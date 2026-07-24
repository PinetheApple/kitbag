import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

import { createRule } from '../utils/create-rule';
import { isInPackage } from '../utils/package-path';

// SPEC §13.6 (Riverpod-providers-only-in-core_services, translated) + §13.4:
// Zustand store constructors live ONLY in core-state. The store is the concrete
// DI/dispatch layer; a store created anywhere else is a shadow source of truth.

const ZUSTAND_SOURCES = new Set([
  'zustand',
  'zustand/vanilla',
  'zustand/react',
]);

// The store-constructor exports. `create`/`createStore` and the equality-fn
// variants are all store factories.
const STORE_FACTORIES = new Set([
  'create',
  'createStore',
  'createWithEqualityFn',
]);

type Options = readonly [{ package?: string }?];
type MessageIds = 'storeFactory';

export const zustandCreateOnlyInCoreState = createRule<Options, MessageIds>({
  name: 'zustand-create-only-in-core-state',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Zustand store constructors are permitted only in core-state (SPEC §13.4, §13.6).',
    },
    schema: [
      {
        type: 'object',
        properties: { package: { type: 'string' } },
        additionalProperties: false,
      },
    ],
    messages: {
      storeFactory:
        "'{{name}}' from '{{source}}' creates a Zustand store — stores live " +
        'only in core-state (SPEC §13.4, §13.6). The engine is the source of ' +
        'truth; do not keep a store elsewhere.',
    },
  },
  defaultOptions: [{}],
  create(context, [options]) {
    const allowedPackage = options?.package ?? 'core-state';
    if (isInPackage(context.filename, allowedPackage)) {
      return {};
    }

    return {
      ImportDeclaration(node: TSESTree.ImportDeclaration) {
        if (!ZUSTAND_SOURCES.has(node.source.value)) {
          return;
        }
        for (const specifier of node.specifiers) {
          if (
            specifier.type === AST_NODE_TYPES.ImportSpecifier &&
            specifier.imported.type === AST_NODE_TYPES.Identifier &&
            STORE_FACTORIES.has(specifier.imported.name)
          ) {
            context.report({
              node: specifier,
              messageId: 'storeFactory',
              data: {
                name: specifier.imported.name,
                source: node.source.value,
              },
            });
          }
        }
      },
    };
  },
});
