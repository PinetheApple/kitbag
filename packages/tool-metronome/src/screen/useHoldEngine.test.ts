import type { MetronomeStore } from '@kitbag/core-state';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useHoldEngine } from './useHoldEngine.ts';

const { effects, release, holdEngine } = vi.hoisted(() => {
  type Effect = () => (() => void) | undefined;
  let deps: readonly unknown[] | undefined;
  let cleanup: (() => void) | undefined;
  const releaseFn = vi.fn();
  return {
    release: releaseFn,
    holdEngine: vi.fn(() => releaseFn),
    effects: {
      run: (effect: Effect, next: readonly unknown[]) => {
        if (deps?.every((dep, i) => Object.is(dep, next[i])) === true) return;
        cleanup?.();
        deps = next;
        cleanup = effect();
      },
      unmount: () => {
        cleanup?.();
        cleanup = undefined;
        deps = undefined;
      },
    },
  };
});

// A mount without a renderer: effects rerun on changed deps and clean up first.
vi.mock('react', () => ({ useEffect: effects.run }));
vi.mock('@kitbag/core-state', () => ({
  useMetronome: (
    select: (state: Pick<MetronomeStore, 'holdEngine'>) => unknown,
  ) => select({ holdEngine }),
}));

beforeEach(() => {
  effects.unmount();
  vi.clearAllMocks();
});

describe('useHoldEngine', () => {
  it('holds while the screen is mounted and releases when it leaves', () => {
    useHoldEngine();
    useHoldEngine();
    expect(holdEngine).toHaveBeenCalledOnce();
    expect(release).not.toHaveBeenCalled();
    effects.unmount();
    expect(release).toHaveBeenCalledOnce();
  });

  it('holds a sheet only while it is open', () => {
    useHoldEngine(false);
    expect(holdEngine).not.toHaveBeenCalled();
    useHoldEngine(true);
    useHoldEngine(true);
    expect(holdEngine).toHaveBeenCalledOnce();
    useHoldEngine(false);
    expect(release).toHaveBeenCalledOnce();
    useHoldEngine(true);
    effects.unmount();
    expect(holdEngine).toHaveBeenCalledTimes(2);
    expect(release).toHaveBeenCalledTimes(2);
  });
});
