import {
  TOOL_REGISTRY_KEY,
  type RegisterTool,
  type ToolHost,
  type ToolPlugin,
  type ToolRegistry,
} from '@kitbag/core-plugin-api';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import {
  KB_EVAL_VERIFIED_TOOL_KEY,
  KB_TOOL_ERROR,
  KB_TOOL_REFUSAL_DETAIL_KEY,
  KB_TOOL_REFUSAL_KEY,
  KB_TOOL_REJECTION,
} from './generated/nativeConstants.gen.ts';
import type * as Loader from './toolLoader.ts';

const tools = vi.hoisted(() => ({ verifyInstalled: vi.fn() }));

vi.mock('./NativeKitbagTools', () => ({ getKitbagTools: () => tools }));

const { TOOL_LOAD_CODE, TOOL_LOAD_STAGE } = await import('./toolLoader.ts');

const ID = 'sample';
const VERIFY_CODE = KB_TOOL_REJECTION.signature;
const HOST = { engine: {}, store: {} } as unknown as ToolHost;
const PLUGIN = {
  id: ID,
  name: 'Sample',
  icon: 'sample',
  routes: [],
} as ToolPlugin;
const MODULE = { react: true };

const modules = vi.fn<(specifier: string) => unknown>(() => MODULE);
const onCrash = vi.fn();
const evalTool = vi.fn<(id: string) => unknown>();
let loader: typeof Loader;

function registry(): ToolRegistry {
  return Reflect.get(globalThis, TOOL_REGISTRY_KEY) as ToolRegistry;
}

function evaluatesTo(id: string, register: RegisterTool): void {
  evalTool.mockImplementation(() => {
    registry().register(id, register);
  });
}

function load() {
  return loader.loadTool(ID, { host: HOST, modules, onCrash });
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  loader = await import('./toolLoader.ts');
  tools.verifyInstalled.mockResolvedValue(undefined);
  evalTool.mockReset();
  Reflect.set(globalThis, KB_EVAL_VERIFIED_TOOL_KEY, evalTool);
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, KB_EVAL_VERIFIED_TOOL_KEY);
  Reflect.deleteProperty(globalThis, TOOL_REGISTRY_KEY);
});

it('verifies natively, evaluates by id, then registers the plugin with the host', async () => {
  const register = vi.fn<RegisterTool>(() => PLUGIN);
  evaluatesTo(ID, register);

  await expect(load()).resolves.toEqual({ ok: true, plugin: PLUGIN });

  expect(tools.verifyInstalled).toHaveBeenCalledExactlyOnceWith(ID);
  expect(evalTool).toHaveBeenCalledExactlyOnceWith(ID);
  expect(tools.verifyInstalled.mock.invocationCallOrder[0]).toBeLessThan(
    evalTool.mock.invocationCallOrder[0] ?? 0,
  );
  expect(register).toHaveBeenCalledExactlyOnceWith(HOST);
  expect(onCrash).not.toHaveBeenCalled();
});

it("resolves the bundle's module imports through the host", async () => {
  evaluatesTo(ID, () => PLUGIN);
  await load();

  expect(registry().module('react')).toBe(MODULE);
  expect(modules).toHaveBeenCalledExactlyOnceWith('react');
});

it('reports a verify rejection without evaluating or counting a crash', async () => {
  tools.verifyInstalled.mockRejectedValue(
    Object.assign(new Error('bad signature'), { code: VERIFY_CODE }),
  );

  const result = await load();

  expect(result).toMatchObject({
    ok: false,
    error: { id: ID, stage: TOOL_LOAD_STAGE.verify, code: VERIFY_CODE },
  });
  expect(evalTool).not.toHaveBeenCalled();
  expect(onCrash).not.toHaveBeenCalled();
});

it('reports a native refusal by its code without counting a crash', async () => {
  const refusal = {
    [KB_TOOL_REFUSAL_KEY]: KB_TOOL_ERROR.bytecodeVersion,
    [KB_TOOL_REFUSAL_DETAIL_KEY]: 'bundle is bytecode 1, runtime 2',
  };
  evalTool.mockReturnValue(refusal);

  const result = await load();

  expect(result).toMatchObject({
    ok: false,
    error: {
      stage: TOOL_LOAD_STAGE.eval,
      code: KB_TOOL_ERROR.bytecodeVersion,
      cause: refusal,
    },
  });
  expect(onCrash).not.toHaveBeenCalled();
});

it.each([
  ['an evaluation error', new Error(`${KB_TOOL_ERROR.eval}: tool:${ID} boom`)],
  [
    'a throw that names a refusal code',
    new Error(`${KB_TOOL_ERROR.notVerified}: forged`),
  ],
])('counts %s as an eval crash', async (_, thrown) => {
  evalTool.mockImplementation(() => {
    throw thrown;
  });

  const result = await load();

  expect(result).toMatchObject({
    ok: false,
    error: {
      id: ID,
      stage: TOOL_LOAD_STAGE.eval,
      code: KB_TOOL_ERROR.eval,
      cause: thrown,
    },
  });
  expect(onCrash).toHaveBeenCalledExactlyOnceWith(
    result.ok ? undefined : result.error,
  );
});

it('catches a throw from register() and feeds the crash hook', async () => {
  const thrown = new Error('register failed');
  evaluatesTo(ID, () => {
    throw thrown;
  });

  const result = await load();

  expect(result).toMatchObject({
    ok: false,
    error: {
      stage: TOOL_LOAD_STAGE.register,
      code: TOOL_LOAD_CODE.registerThrew,
      cause: thrown,
    },
  });
  expect(onCrash).toHaveBeenCalledOnce();
});

it.each([null, undefined, 42, 'plugin'])(
  'counts a register() that returns %s as a crash',
  async (returned) => {
    evaluatesTo(ID, () => returned as unknown as ToolPlugin);

    const result = await load();

    expect(result).toMatchObject({
      ok: false,
      error: {
        stage: TOOL_LOAD_STAGE.register,
        code: TOOL_LOAD_CODE.notPlugin,
      },
    });
    expect(onCrash).toHaveBeenCalledOnce();
  },
);

it.each([
  ['registers nothing', () => undefined, TOOL_LOAD_CODE.notRegistered],
  [
    'registers under another id',
    () => {
      evaluatesTo('other', () => PLUGIN);
    },
    TOOL_LOAD_CODE.notRegistered,
  ],
  [
    "returns another tool's plugin",
    () => {
      evaluatesTo(ID, () => ({ ...PLUGIN, id: 'other' }));
    },
    TOOL_LOAD_CODE.wrongPlugin,
  ],
])(
  'fails a bundle that %s without counting a crash',
  async (_, arrange, code) => {
    arrange();

    const result = await load();

    expect(result).toMatchObject({
      ok: false,
      error: { stage: TOOL_LOAD_STAGE.register, code },
    });
    expect(onCrash).not.toHaveBeenCalled();
  },
);

it('does not count a crash when the runtime has no verified-eval function', async () => {
  Reflect.deleteProperty(globalThis, KB_EVAL_VERIFIED_TOOL_KEY);

  const result = await load();

  expect(result).toMatchObject({
    ok: false,
    error: { stage: TOOL_LOAD_STAGE.eval, code: TOOL_LOAD_CODE.noEval },
  });
  expect(onCrash).not.toHaveBeenCalled();
});

it('does not hand a later load the registration of a bundle that then threw', async () => {
  evalTool.mockImplementation(() => {
    registry().register(ID, () => PLUGIN);
    throw new Error('after registering');
  });
  await load();
  evalTool.mockReset();

  const result = await load();

  expect(result).toMatchObject({
    ok: false,
    error: { code: TOOL_LOAD_CODE.notRegistered },
  });
});

it('shares one verification and evaluation between loads in flight', async () => {
  evaluatesTo(ID, () => PLUGIN);

  const [first, second] = await Promise.all([load(), load()]);

  expect(second).toBe(first);
  expect(tools.verifyInstalled).toHaveBeenCalledOnce();
  expect(evalTool).toHaveBeenCalledOnce();
});

it('hands a loaded tool back without verifying or evaluating it again', async () => {
  const register = vi.fn<RegisterTool>(() => PLUGIN);
  evaluatesTo(ID, register);
  const first = await load();

  await expect(load()).resolves.toBe(first);

  expect(tools.verifyInstalled).toHaveBeenCalledOnce();
  expect(evalTool).toHaveBeenCalledOnce();
  expect(register).toHaveBeenCalledOnce();
});

it('tries again after a failed load', async () => {
  tools.verifyInstalled.mockRejectedValueOnce(new Error('not yet'));
  evaluatesTo(ID, () => PLUGIN);

  await expect(load()).resolves.toMatchObject({ ok: false });
  await expect(load()).resolves.toEqual({ ok: true, plugin: PLUGIN });

  expect(tools.verifyInstalled).toHaveBeenCalledTimes(2);
});

it('keeps the C++, Kotlin and loader codes apart', () => {
  const sets = [KB_TOOL_ERROR, KB_TOOL_REJECTION, TOOL_LOAD_CODE].map(
    (codes) => Object.values(codes) as string[],
  );
  const all = sets.flat();

  expect(new Set(all).size).toBe(all.length);
});
