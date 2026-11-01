import type * as CoreState from '@kitbag/core-state';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  practiceHarness,
  SECOND,
} from '../logic/practiceSessions.test-helper.ts';
import { useEndPracticeOnLeave } from './useEndPracticeOnLeave.ts';

const { effects, current } = vi.hoisted(() => {
  type Effect = () => (() => void) | undefined;
  let cleanup: (() => void) | undefined;
  return {
    current: {
      harness: undefined as ReturnType<typeof practiceHarness> | undefined,
    },
    effects: {
      run: (effect: Effect) => {
        cleanup ??= effect();
      },
      unmount: () => {
        cleanup?.();
        cleanup = undefined;
      },
    },
  };
});

function harness() {
  if (current.harness === undefined) throw new Error('no harness');
  return current.harness;
}

vi.mock('react', () => ({ useEffect: effects.run }));
vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<typeof CoreState>()),
  useMetronome: <T>(select: (state: CoreState.MetronomeStore) => T): T =>
    select(harness().metronome.getState()),
  getPracticeSessionStore: () => harness().sessions,
  get metronomeStore() {
    return harness().metronome;
  },
}));

beforeEach(() => {
  effects.unmount();
  current.harness = practiceHarness();
});

describe('useEndPracticeOnLeave', () => {
  it('ends a stopped session once when the screen goes, and not for under a second', () => {
    const h = harness();
    useEndPracticeOnLeave();
    h.metronome.getState().start();
    h.advance(2 * SECOND);
    h.metronome.getState().stop();
    expect(h.sessions.getState().pending).toEqual([]);
    effects.unmount();
    expect(h.sessions.getState().pending).toHaveLength(1);
    expect(h.pill()).toBe(0);

    useEndPracticeOnLeave();
    h.metronome.getState().start();
    h.advance(SECOND - 1);
    h.metronome.getState().stop();
    effects.unmount();
    expect(h.sessions.getState().pending).toHaveLength(1);
  });

  it('keeps a playing session running when the screen goes', () => {
    const h = harness();
    useEndPracticeOnLeave();
    h.metronome.getState().start();
    h.advance(2 * SECOND);
    const uuid = h.sessions.getState().session?.uuid;
    effects.unmount();
    expect(h.sessions.getState().pending).toEqual([]);
    expect(h.sessions.getState().session?.uuid).toBe(uuid);
    h.advance(3 * SECOND);
    h.metronome.getState().stop();
    expect(h.pill()).toBe(5 * SECOND);
    expect(h.sessions.getState().endSession()?.playedMs).toBe(5 * SECOND);
  });
});
