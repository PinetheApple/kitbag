import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { songStart, type SongStartSlice } from './songStart.ts';
import {
  BAR_BEATS,
  BEAT,
  fakeRuntime,
  HEAD,
  ONE_BAR,
  RATE,
  record,
  stem,
  at,
} from './store.test-helper.ts';

const SESSION = 1;
const BEATS = [0, BEAT, 2 * BEAT, 3 * BEAT, 4 * BEAT];
const DOWNBEATS = [0, BAR_BEATS, 2 * BAR_BEATS];

function started() {
  const fake = fakeRuntime(record([stem(1)]));
  fake.countInBars.mockReturnValue(ONE_BAR);
  let state: SongStartSlice = {
    click: false,
    beats: BEATS,
    downbeatIndices: DOWNBEATS,
    engineRate: RATE,
    countEndFrame: null,
  };
  const start = songStart({
    set: (change) => {
      state = { ...state, ...change };
    },
    get: () => state,
    runtimeOf: () => fake.runtime,
    session: () => SESSION,
  });
  return { ...fake, start, state: () => state };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('stop', () => {
  it('stops a pending count and the song together, forgetting the count', async () => {
    const song = started();
    song.start.play(HEAD);
    await vi.runAllTimersAsync();
    expect(song.start.stop()).toBe(true);
    expect(song.commands.songStop).toHaveBeenCalledOnce();
    expect(song.state().countEndFrame).toBeNull();
    expect(song.start.counting()).toBe(false);
  });

  it('counts in afresh on the next play', async () => {
    const song = started();
    song.start.play(HEAD);
    song.start.stop();
    song.engine.now = at(1);
    song.start.play(0);
    await vi.runAllTimersAsync();
    expect(song.commands.songCountIn).toHaveBeenCalledTimes(2);
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
    expect(song.start.counting()).toBe(true);
  });

  it('does nothing with no count pending', () => {
    const song = started();
    expect(song.start.stop()).toBe(false);
    expect(song.commands.songStop).not.toHaveBeenCalled();
    expect(song.commands.mixerStop).not.toHaveBeenCalled();
  });
});
