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
} from './generated/nativeConstants.gen.ts';

const tools = vi.hoisted(() => ({ verifyInstalled: vi.fn() }));

vi.mock('./NativeKitbagTools', () => ({ getKitbagTools: () => tools }));

const { loadTool, TOOL_LOAD_CODE, TOOL_LOAD_STAGE } =
  await import('./toolLoader.ts');

const ID = 'sample';
const VERIFY_CODE = 'E_TOOL_SIGNATURE';
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
const evalTool = vi.fn<(id: string) => void>();

function registry(): ToolRegistry {
  return Reflect.get(globalThis, TOOL_REGISTRY_KEY) as ToolRegistry;
}

function evaluatesTo(id: string, register: RegisterTool): void {
  evalTool.mockImplementation(() => {
    registry().register(id, register);
  });
}

function load() {
  return loadTool(ID, { host: HOST, modules, onCrash });
}

beforeEach(() => {
  vi.clearAllMocks();
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

it.each([
  [
    'a coded native refusal',
    new Error(
      `${KB_TOOL_ERROR.bytecodeVersion}: tool:${ID} bundle is bytecode 1, runtime 2`,
    ),
    KB_TOOL_ERROR.bytecodeVersion,
  ],
  ['a throw from the bundle itself', new Error('boom'), KB_TOOL_ERROR.eval],
])(
  'catches %s during evaluation and feeds the crash hook',
  async (_, thrown, code) => {
    evalTool.mockImplementation(() => {
      throw thrown;
    });

    const result = await load();

    expect(result).toMatchObject({
      ok: false,
      error: { id: ID, stage: TOOL_LOAD_STAGE.eval, code, cause: thrown },
    });
    expect(onCrash).toHaveBeenCalledExactlyOnceWith(
      result.ok ? undefined : result.error,
    );
  },
);

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
  'fails a bundle that %s and feeds the crash hook',
  async (_, arrange, code) => {
    arrange();

    const result = await load();

    expect(result).toMatchObject({
      ok: false,
      error: { stage: TOOL_LOAD_STAGE.register, code },
    });
    expect(onCrash).toHaveBeenCalledOnce();
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
