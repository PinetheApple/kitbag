import { KB_ACCENT } from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

import type { MetronomeCommands } from './commands.ts';
import { createMetronomeStore } from './store.ts';

function setup() {
  const commands = {
    start: vi.fn(() => Promise.resolve(0)),
    metronomeStart: vi.fn(),
    metronomeStop: vi.fn(),
    metronomePause: vi.fn(),
    setTempo: vi.fn(),
    setBeats: vi.fn(),
    setSubdivision: vi.fn(),
    setAccent: vi.fn(),
    setPoly: vi.fn(),
    setPolyAccent: vi.fn(),
    setSounds: vi.fn(),
    previewSound: vi.fn(),
    setCountIn: vi.fn(),
    setVolume: vi.fn(),
    setLatencyOffset: vi.fn(),
    setRamp: vi.fn(),
    setBarMute: vi.fn(),
  } satisfies MetronomeCommands;
  return { commands, store: createMetronomeStore(commands, () => 0) };
}

describe('pattern actions', () => {
  it('replaces whole accent rows at the current lengths and sends every beat', () => {
    const { commands, store } = setup();
    const {
      KB_ACCENT_ACCENTED: A,
      KB_ACCENT_NORMAL: N,
      KB_ACCENT_MUTED: M,
    } = KB_ACCENT;
    store.getState().setAccents([M, A, N, M, A, A]);
    store.getState().setPolyAccents([N]);
    expect(store.getState().accents).toEqual([M, A, N, M]);
    expect(store.getState().polyAccents).toEqual([N, N, N]);
    expect(commands.setAccent.mock.calls).toEqual([
      [0, M],
      [1, A],
      [2, N],
      [3, M],
    ]);
    expect(commands.setPolyAccent.mock.calls).toEqual([
      [0, N],
      [1, N],
      [2, N],
    ]);
  });
});
