import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

import { createRule } from '../utils/create-rule';
import { isInPackage } from '../utils/package-path';

// SPEC §13.2 / §9.4 / §13.6: JSI + TurboModule access lives ONLY in core-native.
// It is the single holder of the `kb_engine*`. Every other package reaches the
// engine through a core-native export.

// The concrete `react-native` symbols that cross into TurboModule/JSI land.
// Named here, not retyped at call sites (SPEC §13.7).
const REACT_NATIVE_NATIVE_SYMBOLS = new Set([
  'TurboModuleRegistry',
  'codegenNativeComponent',
  'codegenNativeCommands',
]);

// Import specifiers that reach the JSI HostObject / generated native specs.
// e.g. `./KbEngineHostObject`, `../jsi/install`, `./NativeMetronomeSpec`.
const HOST_OBJECT_SPECIFIER = /HostObject|(^|\/)jsi(\/|$)|Spec$/;

type Options = readonly [{ package?: string }?];
type MessageIds = 'nativeSymbol' | 'hostObject';

export const nativeOnlyInCoreNative = createRule<Options, MessageIds>({
  name: 'native-only-in-core-native',
  meta: {
    type: 'problem',
    docs: {
      description:
        'JSI/TurboModule imports are permitted only in core-native (SPEC §13.2).',
    },
    schema: [
      {
        type: 'object',
        properties: { package: { type: 'string' } },
        additionalProperties: false,
      },
    ],
    messages: {
      nativeSymbol:
        "'{{name}}' is a TurboModule/JSI symbol — it may be imported only in " +
        'core-native (SPEC §13.2, §9.4). Reach the engine through a ' +
        'core-native export.',
      hostObject:
        "'{{source}}' is the JSI HostObject / native spec surface — only " +
        'core-native may hold the kb_engine* (SPEC §13.2).',
    },
  },
  defaultOptions: [{}],
  create(context, [options]) {
    const allowedPackage = options?.package ?? 'core-native';
    if (isInPackage(context.filename, allowedPackage)) {
      return {};
    }

    return {
      ImportDeclaration(node: TSESTree.ImportDeclaration) {
        const source = node.source.value;

        if (HOST_OBJECT_SPECIFIER.test(source)) {
          context.report({
            node: node.source,
            messageId: 'hostObject',
            data: { source },
          });
          return;
        }

        if (source !== 'react-native') {
          return;
        }
        for (const specifier of node.specifiers) {
          if (
            specifier.type === AST_NODE_TYPES.ImportSpecifier &&
            specifier.imported.type === AST_NODE_TYPES.Identifier &&
            REACT_NATIVE_NATIVE_SYMBOLS.has(specifier.imported.name)
          ) {
            context.report({
              node: specifier,
              messageId: 'nativeSymbol',
              data: { name: specifier.imported.name },
            });
          }
        }
      },
    };
  },
});
