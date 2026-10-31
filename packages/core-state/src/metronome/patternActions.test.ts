import {
  KB_ACCENT,
  KB_POLY_AGAINST_BAR,
  KB_POLY_AGAINST_BOUNDS,
} from '@kitbag/core-native';
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
    setPolyAgainst: vi.fn(),
    setSounds: vi.fn(),
    previewSound: vi.fn(),
    setCountIn: vi.fn(),
    setVolume: vi.fn(),
    setLatencyOffset: vi.fn(),
    setRamp: vi.fn(),
    setBarMute: vi.fn(),
    engineHold: vi.fn(),
    engineRelease: vi.fn(),
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

  it('resets accents to the group starts when the meter changes', () => {
    const { commands, store } = setup();
    const { KB_ACCENT_ACCENTED: A, KB_ACCENT_NORMAL: N } = KB_ACCENT;
    store.getState().cycleAccent(0);
    commands.setAccent.mockClear();
    store.getState().setBeats(7, 8);
    expect(store.getState().accents).toEqual([A, N, A, N, A, N, N]);
    expect(commands.setAccent.mock.calls).toEqual([
      [0, A],
      [1, N],
      [2, A],
      [3, N],
      [4, A],
      [5, N],
      [6, N],
    ]);
  });

  it('keeps edited accents when only the denominator changes', () => {
    const { commands, store } = setup();
    store.getState().cycleAccent(0);
    const edited = store.getState().accents;
    commands.setAccent.mockClear();
    store.getState().setBeats(4, 8);
    expect(store.getState().accents).toEqual(edited);
    expect(commands.setAccent).not.toHaveBeenCalled();
  });
});

describe('poly against', () => {
  it('starts on the bar', () => {
    const { store } = setup();
    expect(store.getState().polyAgainst).toBe(KB_POLY_AGAINST_BAR);
  });

  it('sends every change to the engine', () => {
    const { commands, store } = setup();
    store.getState().setPolyAgainst(2);
    expect(store.getState().polyAgainst).toBe(2);
    expect(commands.setPolyAgainst).toHaveBeenLastCalledWith(2);
  });

  it('stores and sends the bar sentinel for a count it cannot hold', () => {
    const { commands, store } = setup();
    store.getState().setPolyAgainst(2);
    store.getState().setPolyAgainst(KB_POLY_AGAINST_BOUNDS.max + 1);
    expect(store.getState().polyAgainst).toBe(KB_POLY_AGAINST_BAR);
    expect(commands.setPolyAgainst).toHaveBeenLastCalledWith(
      KB_POLY_AGAINST_BAR,
    );
  });

  it('steps through the beats per bar onto the bar', () => {
    const { commands, store } = setup();
    store.getState().setPolyAgainst(3);
    store.getState().stepPolyAgainst(1);
    expect(store.getState().polyAgainst).toBe(KB_POLY_AGAINST_BAR);
    store.getState().stepPolyAgainst(1);
    expect(store.getState().polyAgainst).toBe(5);
    expect(commands.setPolyAgainst.mock.calls).toEqual([
      [3],
      [KB_POLY_AGAINST_BAR],
      [5],
    ]);
  });

  it('turns an explicit count into the bar when the meter comes to equal it', () => {
    const { commands, store } = setup();
    store.getState().setPolyAgainst(3);
    commands.setPolyAgainst.mockClear();
    store.getState().setBeats(3, 4);
    expect(store.getState().polyAgainst).toBe(KB_POLY_AGAINST_BAR);
    expect(commands.setPolyAgainst).toHaveBeenCalledWith(KB_POLY_AGAINST_BAR);
  });

  it('sends the meter before the bar it turns the count into', () => {
    const { commands, store } = setup();
    store.getState().setPolyAgainst(3);
    commands.setBeats.mockClear();
    commands.setPolyAgainst.mockClear();
    store.getState().setBeats(3, 4);
    const [beats] = commands.setBeats.mock.invocationCallOrder;
    const [against] = commands.setPolyAgainst.mock.invocationCallOrder;
    expect(beats).toBeLessThan(against ?? 0);
  });

  it('keeps an explicit count the new meter does not equal', () => {
    const { commands, store } = setup();
    store.getState().setPolyAgainst(2);
    commands.setPolyAgainst.mockClear();
    store.getState().setBeats(3, 4);
    expect(store.getState().polyAgainst).toBe(2);
    expect(commands.setPolyAgainst).not.toHaveBeenCalled();
  });

  it('stores a count equal to the bar as the bar', () => {
    const { commands, store } = setup();
    store.getState().setPolyAgainst(store.getState().beatsPerBar);
    expect(store.getState().polyAgainst).toBe(KB_POLY_AGAINST_BAR);
    expect(commands.setPolyAgainst).toHaveBeenLastCalledWith(
      KB_POLY_AGAINST_BAR,
    );
  });
});
