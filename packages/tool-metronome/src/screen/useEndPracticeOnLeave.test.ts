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
}));

beforeEach(() => {
  effects.unmount();
  current.harness = practiceHarness();
});

describe('useEndPracticeOnLeave', () => {
  it('ends the session once when the screen goes, and not for under a second', () => {
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
});
