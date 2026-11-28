import {
  TOOL_REGISTRY_KEY,
  type RegisterTool,
  type ToolHost,
  type ToolPlugin,
  type ToolRegistry,
} from '@kitbag/core-plugin-api';

import {
  KB_EVAL_VERIFIED_TOOL_KEY,
  KB_TOOL_ERROR,
} from './generated/nativeConstants.gen.ts';
import { getKitbagTools } from './NativeKitbagTools';

export const TOOL_LOAD_STAGE = {
  verify: 'verify',
  eval: 'eval',
  register: 'register',
} as const;
export type ToolLoadStage =
  (typeof TOOL_LOAD_STAGE)[keyof typeof TOOL_LOAD_STAGE];

export const TOOL_LOAD_CODE = {
  unverified: 'E_TOOL_UNVERIFIED',
  noEval: 'E_TOOL_NO_EVAL',
  notRegistered: 'E_TOOL_NOT_REGISTERED',
  registerThrew: 'E_TOOL_REGISTER',
  wrongPlugin: 'E_TOOL_WRONG_PLUGIN',
} as const;

export class ToolLoadError extends Error {
  constructor(
    readonly id: string,
    readonly stage: ToolLoadStage,
    readonly code: string,
    override readonly cause?: unknown,
  ) {
    super(`${code}: tool ${id} failed at ${stage}`);
  }
}

export interface ToolLoadOptions {
  readonly host: ToolHost;
  readonly modules: ToolRegistry['module'];
  readonly onCrash: (error: ToolLoadError) => void;
}

export type ToolLoadResult =
  | { readonly ok: true; readonly plugin: ToolPlugin }
  | { readonly ok: false; readonly error: ToolLoadError };

const TOOL_ERROR_CODES = new Set<string>(Object.values(KB_TOOL_ERROR));
const CODE_SEPARATOR = ':';
const registrations = new Map<string, RegisterTool>();

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function nativeCode(error: unknown): string {
  const code: unknown = Reflect.get(Object(error), 'code');
  return typeof code === 'string' ? code : TOOL_LOAD_CODE.unverified;
}

function evalCode(error: unknown): string {
  const prefix = messageOf(error).split(CODE_SEPARATOR, 1)[0] ?? '';
  return TOOL_ERROR_CODES.has(prefix) ? prefix : KB_TOOL_ERROR.eval;
}

function isEval(value: unknown): value is (id: string) => void {
  return typeof value === 'function';
}

function installRegistry(modules: ToolRegistry['module']): void {
  const registry: ToolRegistry = {
    module: modules,
    register: (id, register) => {
      registrations.set(id, register);
    },
  };
  Reflect.set(globalThis, TOOL_REGISTRY_KEY, registry);
}

function failed(error: ToolLoadError): ToolLoadResult {
  return { ok: false, error };
}

function crashed(
  options: ToolLoadOptions,
  error: ToolLoadError,
): ToolLoadResult {
  options.onCrash(error);
  return failed(error);
}

function evaluate(
  id: string,
  options: ToolLoadOptions,
): ToolLoadResult | RegisterTool {
  const evalVerifiedTool: unknown = Reflect.get(
    globalThis,
    KB_EVAL_VERIFIED_TOOL_KEY,
  );
  if (!isEval(evalVerifiedTool)) {
    return failed(
      new ToolLoadError(id, TOOL_LOAD_STAGE.eval, TOOL_LOAD_CODE.noEval),
    );
  }
  registrations.clear();
  installRegistry(options.modules);
  try {
    evalVerifiedTool(id);
  } catch (error) {
    return crashed(
      options,
      new ToolLoadError(id, TOOL_LOAD_STAGE.eval, evalCode(error), error),
    );
  }
  const register = registrations.get(id);
  registrations.clear();
  return (
    register ??
    crashed(
      options,
      new ToolLoadError(
        id,
        TOOL_LOAD_STAGE.register,
        TOOL_LOAD_CODE.notRegistered,
      ),
    )
  );
}

function register(
  id: string,
  registerTool: RegisterTool,
  options: ToolLoadOptions,
): ToolLoadResult {
  let plugin: ToolPlugin;
  try {
    plugin = registerTool(options.host);
  } catch (error) {
    return crashed(
      options,
      new ToolLoadError(
        id,
        TOOL_LOAD_STAGE.register,
        TOOL_LOAD_CODE.registerThrew,
        error,
      ),
    );
  }
  if (plugin.id !== id) {
    return crashed(
      options,
      new ToolLoadError(
        id,
        TOOL_LOAD_STAGE.register,
        TOOL_LOAD_CODE.wrongPlugin,
      ),
    );
  }
  return { ok: true, plugin };
}

export async function loadTool(
  id: string,
  options: ToolLoadOptions,
): Promise<ToolLoadResult> {
  try {
    await getKitbagTools().verifyInstalled(id);
  } catch (error) {
    return failed(
      new ToolLoadError(id, TOOL_LOAD_STAGE.verify, nativeCode(error), error),
    );
  }
  const evaluated = evaluate(id, options);
  return typeof evaluated === 'function'
    ? register(id, evaluated, options)
    : evaluated;
}
