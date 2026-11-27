import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

import { createRule } from '../utils/create-rule';

const FRAME_CALLBACK_HOOK = 'useFrameCallback';
const STATE_HOOK = 'useState';
const STORE_WRITE = 'setState';
const WORKLET_DIRECTIVE = 'worklet';
const SETTER_INDEX = 1;

type FunctionNode =
  | TSESTree.ArrowFunctionExpression
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression;

interface Write {
  readonly node: TSESTree.Node;
  readonly name: string;
  readonly storeWrite: boolean;
}

type MessageIds = 'stateWrite';

function nameOf(node: TSESTree.Node): string | undefined {
  if (node.type === AST_NODE_TYPES.Identifier) return node.name;
  if (
    node.type === AST_NODE_TYPES.MemberExpression &&
    node.property.type === AST_NODE_TYPES.Identifier
  ) {
    return node.property.name;
  }
  return undefined;
}

function isFunction(node: TSESTree.Node): node is FunctionNode {
  return (
    node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    node.type === AST_NODE_TYPES.FunctionDeclaration ||
    node.type === AST_NODE_TYPES.FunctionExpression
  );
}

function isWorklet(fn: FunctionNode): boolean {
  if (fn.body.type !== AST_NODE_TYPES.BlockStatement) return false;
  const [first] = fn.body.body;
  return (
    first?.type === AST_NODE_TYPES.ExpressionStatement &&
    first.directive === WORKLET_DIRECTIVE
  );
}

function isFrameCallback(fn: FunctionNode): boolean {
  const { parent } = fn;
  const passedToFrameHook =
    parent.type === AST_NODE_TYPES.CallExpression &&
    nameOf(parent.callee) === FRAME_CALLBACK_HOOK &&
    parent.arguments[0] === fn;
  return passedToFrameHook || isWorklet(fn);
}

function stateSetter(node: TSESTree.VariableDeclarator): string | undefined {
  const { id, init } = node;
  if (init?.type !== AST_NODE_TYPES.CallExpression) return undefined;
  if (nameOf(init.callee) !== STATE_HOOK) return undefined;
  if (id.type !== AST_NODE_TYPES.ArrayPattern) return undefined;
  const setter = id.elements[SETTER_INDEX];
  return setter?.type === AST_NODE_TYPES.Identifier ? setter.name : undefined;
}

function writeOf(node: TSESTree.Node): Write | undefined {
  const name = nameOf(node);
  if (name === undefined) return undefined;
  const storeWrite =
    node.type === AST_NODE_TYPES.MemberExpression && name === STORE_WRITE;
  if (node.type !== AST_NODE_TYPES.Identifier && !storeWrite) return undefined;
  return { node, name, storeWrite };
}

export const noStateWritesInFrameCallback = createRule<[], MessageIds>({
  name: 'no-state-writes-in-frame-callback',
  meta: {
    defaultOptions: [],
    type: 'problem',
    docs: {
      description:
        'A frame callback writes realtime values to SharedValues, never to a store or React state (SPEC §13.3).',
    },
    schema: [],
    messages: {
      stateWrite:
        "'{{name}}' writes store or React state from a frame callback. " +
        'Write the engine read to a SharedValue (SPEC §13.3, §13.4).',
    },
  },
  create(context) {
    const setters = new Set<string>();
    const writes: Write[] = [];
    const inFrameCallback = (node: TSESTree.Node): boolean =>
      context.sourceCode
        .getAncestors(node)
        .some((ancestor) => isFunction(ancestor) && isFrameCallback(ancestor));

    return {
      VariableDeclarator(node) {
        const setter = stateSetter(node);
        if (setter !== undefined) setters.add(setter);
      },
      CallExpression(node) {
        if (!inFrameCallback(node)) return;
        for (const target of [node.callee, ...node.arguments]) {
          const write = writeOf(target);
          if (write !== undefined) writes.push(write);
        }
      },
      'Program:exit'() {
        for (const { node, name, storeWrite } of writes) {
          if (storeWrite || setters.has(name)) {
            context.report({ node, messageId: 'stateWrite', data: { name } });
          }
        }
      },
    };
  },
});
