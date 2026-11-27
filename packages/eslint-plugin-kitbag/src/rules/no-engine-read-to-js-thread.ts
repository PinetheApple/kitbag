import {
  AST_NODE_TYPES,
  ASTUtils,
  type TSESLint,
  type TSESTree,
} from '@typescript-eslint/utils';

import { createRule } from '../utils/create-rule.ts';

const ENGINE_READS = 'reads';
const STORE_WRITE = 'setState';
const STATE_HOOK = 'useState';
const SETTER_INDEX = 1;
const WORKLET_DIRECTIVE = 'worklet';
const SCHEDULE_ON_JS = 'scheduleOnRN';
const RUN_ON_JS = 'runOnJS';
const REACTION_HOOK = 'useAnimatedReaction';
const REACTION_SOURCE_INDEX = 0;
const REACTION_HANDLER_INDEX = 1;
const GESTURE_BUILDER = 'Gesture';

const AUTO_WORKLET_HOOKS = new Set([
  'useFrameCallback',
  'useAnimatedReaction',
  'useDerivedValue',
  'useAnimatedStyle',
  'useAnimatedProps',
]);

const GESTURE_CALLBACKS = new Set([
  'onBegin',
  'onStart',
  'onUpdate',
  'onChange',
  'onEnd',
  'onFinalize',
  'onTouchesDown',
  'onTouchesMove',
  'onTouchesUp',
  'onTouchesCancelled',
]);

type FunctionNode =
  | TSESTree.ArrowFunctionExpression
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression;
type Variable = TSESLint.Scope.Variable;
type Visit = (
  node: TSESTree.Node,
  parent: TSESTree.Node | undefined,
) => boolean;
type MessageIds = 'engineReadToJs';
type SourceCode = Readonly<TSESLint.SourceCode>;
type Report = (node: TSESTree.CallExpression, name: string) => void;

function nameOf(node: TSESTree.Node): string | undefined {
  if (node.type === AST_NODE_TYPES.Identifier) return node.name;
  if (
    node.type === AST_NODE_TYPES.MemberExpression &&
    !node.computed &&
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

function hasWorkletDirective(fn: FunctionNode): boolean {
  if (fn.body.type !== AST_NODE_TYPES.BlockStatement) return false;
  const [first] = fn.body.body;
  return (
    first?.type === AST_NODE_TYPES.ExpressionStatement &&
    first.directive === WORKLET_DIRECTIVE
  );
}

function callRoot(node: TSESTree.Node): string | undefined {
  let current = node;
  for (;;) {
    if (current.type === AST_NODE_TYPES.MemberExpression)
      current = current.object;
    else if (current.type === AST_NODE_TYPES.CallExpression)
      current = current.callee;
    else return nameOf(current);
  }
}

function isAutoWorkletArgument(fn: FunctionNode): boolean {
  const { parent } = fn;
  if (parent.type !== AST_NODE_TYPES.CallExpression) return false;
  const hook = nameOf(parent.callee);
  return hook !== undefined && AUTO_WORKLET_HOOKS.has(hook);
}

function isGestureCallback(fn: FunctionNode): boolean {
  const { parent } = fn;
  if (parent.type !== AST_NODE_TYPES.CallExpression) return false;
  const { callee } = parent;
  if (callee.type !== AST_NODE_TYPES.MemberExpression) return false;
  const method = nameOf(callee);
  return (
    method !== undefined &&
    GESTURE_CALLBACKS.has(method) &&
    callRoot(callee.object) === GESTURE_BUILDER
  );
}

function isUiThreadCallback(fn: FunctionNode): boolean {
  return (
    hasWorkletDirective(fn) ||
    isAutoWorkletArgument(fn) ||
    isGestureCallback(fn)
  );
}

function reactionSource(fn: FunctionNode): TSESTree.Node | undefined {
  const { parent } = fn;
  if (parent.type !== AST_NODE_TYPES.CallExpression) return undefined;
  if (nameOf(parent.callee) !== REACTION_HOOK) return undefined;
  if (parent.arguments[REACTION_HANDLER_INDEX] !== fn) return undefined;
  return parent.arguments[REACTION_SOURCE_INDEX];
}

function isPropertyName(node: TSESTree.Node, parent?: TSESTree.Node): boolean {
  if (parent?.type === AST_NODE_TYPES.Property) {
    return parent.key === node && !parent.computed && !parent.shorthand;
  }
  if (parent?.type === AST_NODE_TYPES.MemberExpression) {
    return parent.property === node && !parent.computed;
  }
  return false;
}

function childNodes(
  node: TSESTree.Node,
  keys: TSESLint.SourceCode.VisitorKeys,
): TSESTree.Node[] {
  const fields = node as unknown as Record<string, unknown>;
  return (keys[node.type] ?? []).flatMap((key) => {
    const value = fields[key];
    const items: unknown[] = Array.isArray(value) ? value : [value];
    return items.filter(
      (item): item is TSESTree.Node =>
        typeof item === 'object' && item !== null && 'type' in item,
    );
  });
}

function walk(
  node: TSESTree.Node,
  keys: TSESLint.SourceCode.VisitorKeys,
  visit: Visit,
  parent?: TSESTree.Node,
): void {
  if (!visit(node, parent)) return;
  for (const child of childNodes(node, keys)) walk(child, keys, visit, node);
}

function someNode(
  node: TSESTree.Node,
  keys: TSESLint.SourceCode.VisitorKeys,
  test: (node: TSESTree.Node, parent?: TSESTree.Node) => boolean,
): boolean {
  let found = false;
  walk(node, keys, (current, parent) => {
    found ||= test(current, parent);
    return !found;
  });
  return found;
}

class Bindings {
  readonly engineReadFns = new Set<Variable>();
  readonly readsObjects = new Set<Variable>();
  readonly setters = new Set<Variable>();

  private readonly sourceCode: SourceCode;

  constructor(sourceCode: SourceCode) {
    this.sourceCode = sourceCode;
  }

  resolve(id: TSESTree.Identifier): Variable | null {
    return ASTUtils.findVariable(this.sourceCode.getScope(id), id);
  }

  isReadsObject(node: TSESTree.Node): boolean {
    if (node.type !== AST_NODE_TYPES.Identifier) {
      return nameOf(node) === ENGINE_READS;
    }
    const variable = this.resolve(node);
    return variable !== null && this.readsObjects.has(variable);
  }

  isEngineReadCall(node: TSESTree.Node): boolean {
    if (node.type !== AST_NODE_TYPES.CallExpression) return false;
    const { callee } = node;
    if (callee.type === AST_NODE_TYPES.MemberExpression) {
      return this.isReadsObject(callee.object);
    }
    return this.isIn(this.engineReadFns, callee);
  }

  isStateWrite(callee: TSESTree.Node): boolean {
    if (callee.type === AST_NODE_TYPES.MemberExpression) {
      return nameOf(callee) === STORE_WRITE;
    }
    return this.isIn(this.setters, callee);
  }

  isIn(set: Set<Variable>, node: TSESTree.Node): boolean {
    if (node.type !== AST_NODE_TYPES.Identifier) return false;
    const variable = this.resolve(node);
    return variable !== null && set.has(variable);
  }

  record(node: TSESTree.VariableDeclarator): void {
    const { id, init } = node;
    if (init === null) return;
    const declared = this.sourceCode.getDeclaredVariables(node);
    if (this.isReadsObject(init)) {
      const into =
        id.type === AST_NODE_TYPES.Identifier
          ? this.readsObjects
          : this.engineReadFns;
      declared.forEach((variable) => into.add(variable));
    } else if (
      init.type === AST_NODE_TYPES.MemberExpression &&
      this.isReadsObject(init.object)
    ) {
      declared.forEach((variable) => this.engineReadFns.add(variable));
    } else {
      this.recordSetter(id, init, declared);
    }
  }

  private recordSetter(
    id: TSESTree.BindingName,
    init: TSESTree.Expression,
    declared: readonly Variable[],
  ): void {
    if (init.type !== AST_NODE_TYPES.CallExpression) return;
    if (nameOf(init.callee) !== STATE_HOOK) return;
    if (id.type !== AST_NODE_TYPES.ArrayPattern) return;
    const setter = id.elements[SETTER_INDEX];
    if (setter?.type !== AST_NODE_TYPES.Identifier) return;
    for (const variable of declared) {
      if (variable.identifiers.includes(setter)) this.setters.add(variable);
    }
  }
}

class CallbackAnalysis {
  private readonly derived = new Set<Variable>();
  private readonly bindings: Bindings;
  private readonly sourceCode: SourceCode;
  private readonly report: Report;
  private readonly keys: TSESLint.SourceCode.VisitorKeys;

  constructor(bindings: Bindings, sourceCode: SourceCode, report: Report) {
    this.bindings = bindings;
    this.sourceCode = sourceCode;
    this.report = report;
    this.keys = sourceCode.visitorKeys;
  }

  run(fn: FunctionNode): void {
    this.deriveReactionParams(fn);
    walk(fn.body, this.keys, (node) => this.visit(node));
  }

  private visit(node: TSESTree.Node): boolean {
    if (isFunction(node) && isUiThreadCallback(node)) return false;
    if (node.type === AST_NODE_TYPES.VariableDeclarator && node.init !== null) {
      this.markDerived(this.sourceCode.getDeclaredVariables(node), node.init);
    } else if (
      node.type === AST_NODE_TYPES.AssignmentExpression &&
      node.left.type === AST_NODE_TYPES.Identifier
    ) {
      const variable = this.bindings.resolve(node.left);
      this.markDerived(variable === null ? [] : [variable], node.right);
    } else if (node.type === AST_NODE_TYPES.CallExpression) {
      this.checkCall(node);
    }
    return true;
  }

  private deriveReactionParams(fn: FunctionNode): void {
    const source = reactionSource(fn);
    if (source === undefined || !this.derivesFromEngineRead(source)) return;
    for (const variable of this.sourceCode.getDeclaredVariables(fn)) {
      if (variable.defs.some((def) => def.node === fn)) {
        this.derived.add(variable);
      }
    }
  }

  private markDerived(
    targets: readonly Variable[],
    value: TSESTree.Node,
  ): void {
    if (!this.derivesFromEngineRead(value)) return;
    targets.forEach((variable) => this.derived.add(variable));
  }

  private derivesFromEngineRead(node: TSESTree.Node): boolean {
    return someNode(node, this.keys, (current, parent) => {
      if (this.bindings.isEngineReadCall(current)) return true;
      if (isPropertyName(current, parent)) return false;
      return this.bindings.isIn(this.derived, current);
    });
  }

  private handsOff(args: readonly TSESTree.CallExpressionArgument[]): boolean {
    return args.some((arg) => this.derivesFromEngineRead(arg));
  }

  private checkCall(call: TSESTree.CallExpression): void {
    const { callee } = call;
    if (nameOf(callee) === SCHEDULE_ON_JS) {
      if (this.handsOff(call.arguments.slice(1)))
        this.report(call, SCHEDULE_ON_JS);
    } else if (
      callee.type === AST_NODE_TYPES.CallExpression &&
      nameOf(callee.callee) === RUN_ON_JS
    ) {
      if (this.handsOff(call.arguments)) this.report(call, RUN_ON_JS);
    } else if (
      this.bindings.isStateWrite(callee) &&
      this.handsOff(call.arguments)
    ) {
      this.report(call, nameOf(callee) ?? STORE_WRITE);
    }
  }
}

export const noEngineReadToJsThread = createRule<[], MessageIds>({
  name: 'no-engine-read-to-js-thread',
  meta: {
    defaultOptions: [],
    type: 'problem',
    docs: {
      description:
        'A UI-thread callback never hands an engine read to the JS thread or into store or React state (SPEC §13.3, §13.4).',
    },
    schema: [],
    messages: {
      engineReadToJs:
        "'{{name}}' hands an engine read from a UI-thread callback to the JS " +
        'thread. Write it to a SharedValue (SPEC §13.3, §13.4).',
    },
  },
  create(context) {
    const bindings = new Bindings(context.sourceCode);
    const uiCallbacks: FunctionNode[] = [];
    const report: Report = (node, name) => {
      context.report({ node, messageId: 'engineReadToJs', data: { name } });
    };
    return {
      VariableDeclarator: (node) => {
        bindings.record(node);
      },
      ':function': (node: FunctionNode) => {
        if (isUiThreadCallback(node)) uiCallbacks.push(node);
      },
      'Program:exit': () => {
        for (const fn of uiCallbacks) {
          new CallbackAnalysis(bindings, context.sourceCode, report).run(fn);
        }
      },
    };
  },
});
