import { KB_RESULT } from '@kitbag/core-native';
import {
  createMetronomeStore,
  createSubdivisionAccentsStore,
  type MetronomeCommands,
  type RouteLatencyStore,
} from '@kitbag/core-state';
import type { AppStateStatus } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import type { AppStateSource } from './rigClickLifecycle.ts';
import { startRig } from './rigStart.ts';

function commands(): MetronomeCommands {
  const none = () => undefined;
  return new Proxy({} as MetronomeCommands, {
    get: (_target, name) =>
      name === 'start' || name === 'engineHold'
        ? () => Promise.resolve(KB_RESULT.KB_OK)
        : none,
  });
}

function harness(storedVolume?: number) {
  const metronome = createMetronomeStore(
    commands(),
    () => 0,
    () => 0,
  );
  const saved: number[] = [];
  const flushes = vi.fn();
  let listener: ((state: AppStateStatus) => void) | undefined;
  const appState: AppStateSource = {
    addEventListener: (_type, next) => {
      listener = next;
      return { remove: () => undefined };
    },
  };
  const routeLatency = {
    getState: () => ({ start: () => Promise.resolve(), flush: flushes }),
  } as unknown as RouteLatencyStore;
  startRig({
    routeLatency,
    metronome,
    volume: {
      load: () => storedVolume,
      save: (volume) => saved.push(volume),
    },
    sendAccents: () => undefined,
    appState,
    accents: createSubdivisionAccentsStore(),
  });
  return {
    metronome,
    saved,
    flushes,
    appState: (state: AppStateStatus) => listener?.(state),
  };
}

describe('starting the rig', () => {
  it('restores the stored click volume', () => {
    expect(harness(1.7).metronome.getState().volume).toBe(1.7);
  });

  it('keeps the default volume when none is stored', () => {
    const { metronome, saved } = harness();
    expect(metronome.getState().volume).toBe(1);
    expect(saved).toEqual([]);
  });

  it('saves the click volume each time it changes', () => {
    const { metronome, saved } = harness();
    metronome.getState().setVolume(0.4);
    metronome.getState().setVolume(0.4);
    expect(saved).toEqual([0.4]);
  });

  it('writes pending latency steps when the app goes to the background', () => {
    const { flushes, appState } = harness();
    appState('inactive');
    expect(flushes).not.toHaveBeenCalled();
    appState('background');
    expect(flushes).toHaveBeenCalledOnce();
  });
});
