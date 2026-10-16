import type { TuningRepository } from '@kitbag/core-db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TunerRuntime } from './runtime.ts';

function fakeRuntime(): TunerRuntime {
  return {
    commands: {} as TunerRuntime['commands'],
    micPermission: {
      check: () => Promise.resolve('granted'),
      request: () => Promise.resolve('granted'),
    },
    appActivity: { subscribe: () => () => undefined },
  };
}

function fakeRepo(): TuningRepository {
  return {
    list: vi.fn(() => Promise.resolve([])),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

describe('tuner runtime', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('throws on use when nothing is configured', async () => {
    const { getTunerRuntime, getTunings } = await import('./runtime.ts');
    expect(getTunerRuntime).toThrow('not configured');
    expect(getTunings).toThrow('not configured');
  });

  it('importing the store singleton does not resolve the runtime', async () => {
    await expect(import('./store.ts')).resolves.toBeDefined();
  });

  it('configures once and rejects a different runtime or repository', async () => {
    const { configureTunerRuntime, configureTunings } =
      await import('./runtime.ts');
    const runtime = fakeRuntime();
    const repo = fakeRepo();
    configureTunerRuntime(runtime);
    configureTunings(repo);

    expect(() => {
      configureTunerRuntime(runtime);
    }).not.toThrow();
    expect(() => {
      configureTunerRuntime(fakeRuntime());
    }).toThrow('already configured');
    expect(() => {
      configureTunings(fakeRepo());
    }).toThrow('already configured');
  });

  it('the singleton uses what was configured after import', async () => {
    const { tunerStore } = await import('./store.ts');
    const { configureTunings } = await import('./runtime.ts');
    const list = vi.fn(() => Promise.resolve([]));
    configureTunings({ ...fakeRepo(), list });

    await tunerStore.getState().loadCustomTunings();
    expect(list).toHaveBeenCalledTimes(1);
  });
});
