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
  KB_TOOL_REFUSAL_KEY,
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
  notPlugin: 'E_TOOL_NOT_PLUGIN',
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

type EvalVerifiedTool = (id: string) => unknown;

const registrations = new Map<string, RegisterTool>();
const loads = new Map<string, Promise<ToolLoadResult>>();

function nativeCode(error: unknown): string {
  const code: unknown = Reflect.get(Object(error), 'code');
  return typeof code === 'string' ? code : TOOL_LOAD_CODE.unverified;
}

function refusalCode(result: unknown): string | undefined {
  const code: unknown =
    typeof result === 'object' && result !== null
      ? Reflect.get(result, KB_TOOL_REFUSAL_KEY)
      : undefined;
  return typeof code === 'string' ? code : undefined;
}

function isEval(value: unknown): value is EvalVerifiedTool {
  return typeof value === 'function';
}

function isPlugin(value: unknown): value is ToolPlugin {
  return typeof value === 'object' && value !== null;
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

function evaluateBundle(
  id: string,
  options: ToolLoadOptions,
): ToolLoadResult | undefined {
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
  let result: unknown;
  try {
    result = evalVerifiedTool(id);
  } catch (error) {
    return crashed(
      options,
      new ToolLoadError(id, TOOL_LOAD_STAGE.eval, KB_TOOL_ERROR.eval, error),
    );
  }
  const refusal = refusalCode(result);
  return refusal === undefined
    ? undefined
    : failed(new ToolLoadError(id, TOOL_LOAD_STAGE.eval, refusal, result));
}

function takeRegistration(id: string): RegisterTool | undefined {
  const register = registrations.get(id);
  registrations.clear();
  return register;
}

function register(
  id: string,
  registerTool: RegisterTool,
  options: ToolLoadOptions,
): ToolLoadResult {
  const registerFailed = (code: string, cause?: unknown) =>
    crashed(
      options,
      new ToolLoadError(id, TOOL_LOAD_STAGE.register, code, cause),
    );
  let plugin: unknown;
  try {
    plugin = registerTool(options.host);
  } catch (error) {
    return registerFailed(TOOL_LOAD_CODE.registerThrew, error);
  }
  if (!isPlugin(plugin)) {
    return registerFailed(TOOL_LOAD_CODE.notPlugin, plugin);
  }
  if (plugin.id !== id) {
    return failed(
      new ToolLoadError(
        id,
        TOOL_LOAD_STAGE.register,
        TOOL_LOAD_CODE.wrongPlugin,
      ),
    );
  }
  return { ok: true, plugin };
}

async function load(
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
  const evalFailure = evaluateBundle(id, options);
  if (evalFailure !== undefined) return evalFailure;
  const registerTool = takeRegistration(id);
  return registerTool === undefined
    ? failed(
        new ToolLoadError(
          id,
          TOOL_LOAD_STAGE.register,
          TOOL_LOAD_CODE.notRegistered,
        ),
      )
    : register(id, registerTool, options);
}

// Hermes cannot unload evaluated code, so a loaded tool is reused, never re-evaluated.
export function loadTool(
  id: string,
  options: ToolLoadOptions,
): Promise<ToolLoadResult> {
  const existing = loads.get(id);
  if (existing !== undefined) return existing;
  const loading = load(id, options).then((result) => {
    if (!result.ok) loads.delete(id);
    return result;
  });
  loads.set(id, loading);
  return loading;
}
