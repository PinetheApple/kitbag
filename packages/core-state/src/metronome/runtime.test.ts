import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MetronomeRuntime } from './runtime.ts';

const nativeCommands = {
  start: vi.fn(() => Promise.resolve(7)),
  setTempo: vi.fn(),
};
const getKitbagCommands = vi.fn(() => nativeCommands);
const getKitbagHostObject = vi.fn(() => ({ frames_rendered: 99 }));

vi.mock('@kitbag/core-native', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getKitbagCommands,
  getKitbagHostObject,
}));

function fakeRuntime(frame: number): MetronomeRuntime {
  return {
    commands: {
      start: vi.fn(() => Promise.resolve(1)),
      setTempo: vi.fn(),
    } as unknown as MetronomeRuntime['commands'],
    nowFrame: () => frame,
  };
}

async function load() {
  const runtime = await import('./runtime.ts');
  const commands = await import('./commands.ts');
  const store = await import('./store.ts');
  return { ...runtime, ...commands, ...store };
}

describe('metronome runtime', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('falls back to native lazily when nothing is configured', async () => {
    const { defaultCommands, defaultNowFrame } = await load();
    expect(getKitbagCommands).not.toHaveBeenCalled();

    defaultCommands.setTempo(130);
    await expect(defaultCommands.start()).resolves.toBe(7);

    expect(nativeCommands.setTempo).toHaveBeenCalledWith(130);
    expect(defaultNowFrame()).toBe(99);
  });

  it('routes commands and nowFrame to the configured runtime', async () => {
    const { configureMetronomeRuntime, defaultCommands, defaultNowFrame } =
      await load();
    const web = fakeRuntime(42);
    configureMetronomeRuntime(web);

    defaultCommands.setTempo(140);
    await expect(defaultCommands.start()).resolves.toBe(1);

    expect(web.commands.setTempo).toHaveBeenCalledWith(140);
    expect(defaultNowFrame()).toBe(42);
    expect(getKitbagCommands).not.toHaveBeenCalled();
    expect(getKitbagHostObject).not.toHaveBeenCalled();
  });

  it('configures once and rejects a different runtime', async () => {
    const { configureMetronomeRuntime } = await load();
    const web = fakeRuntime(1);
    configureMetronomeRuntime(web);

    expect(() => {
      configureMetronomeRuntime(web);
    }).not.toThrow();
    expect(() => {
      configureMetronomeRuntime(fakeRuntime(2));
    }).toThrow('already configured');
  });

  it('keeps the store singleton when configured after import', async () => {
    const { configureMetronomeRuntime, metronomeStore } = await load();
    const before = metronomeStore;
    const web = fakeRuntime(0);
    configureMetronomeRuntime(web);

    metronomeStore.getState().setTempo(150);

    expect((await import('./store.ts')).metronomeStore).toBe(before);
    expect(web.commands.setTempo).toHaveBeenCalledWith(150);
  });
});
