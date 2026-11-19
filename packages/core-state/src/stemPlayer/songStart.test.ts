import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { followNewGrid } from './clickActions.ts';
import { songStart, type SongStartSlice } from './songStart.ts';
import type { StemPlayerStatus } from './store.ts';
import {
  at,
  BAR_BEATS,
  BEAT,
  fakeRuntime,
  HEAD,
  ONE_BAR,
  RATE,
  record,
  stem,
} from './store.test-helper.ts';

const SESSION = 1;
const READY: StemPlayerStatus = 'ready';
const BEATS = [0, BEAT, 2 * BEAT, 3 * BEAT, 4 * BEAT];
const DOWNBEATS = [0, BAR_BEATS, 2 * BAR_BEATS];
const BAR_AT_HEAD = at(2 * BEAT);
const NEW_BEAT = 0.6;
const NEW_BEATS = [0, NEW_BEAT, 2 * NEW_BEAT, 3 * NEW_BEAT, 4 * NEW_BEAT];

function started({ click = false } = {}) {
  const fake = fakeRuntime(record([stem(1)]));
  fake.countInBars.mockReturnValue(ONE_BAR);
  let state: SongStartSlice = {
    click,
    beats: BEATS,
    downbeatIndices: DOWNBEATS,
    engineRate: RATE,
    countEndFrame: null,
  };
  const releaseClick = vi.fn(() => {
    const wasOn = state.click;
    state = { ...state, click: false };
    return wasOn;
  });
  const start = songStart({
    set: (change) => {
      state = { ...state, ...change };
    },
    get: () => state,
    runtimeOf: () => fake.runtime,
    session: () => SESSION,
    releaseClick,
  });
  const replaceGrid = (beats: readonly number[]) => {
    state = { ...state, beats };
  };
  const clickContext = {
    set: (change: Partial<SongStartSlice>) => {
      state = { ...state, ...change };
    },
    get: () => ({ ...state, status: READY }),
    runtimeOf: () => fake.runtime,
    session: () => SESSION,
  };
  return {
    ...fake,
    start,
    releaseClick,
    replaceGrid,
    clickContext,
    state: () => state,
  };
}

function counting(options: { click?: boolean } = {}) {
  const song = started(options);
  song.start.play(HEAD);
  song.engine.position = BAR_AT_HEAD;
  vi.clearAllMocks();
  return song;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('stop', () => {
  it('stops a pending count and the song together, forgetting the count', () => {
    const song = counting();
    expect(song.start.stop()).toBe(true);
    expect(song.commands.songStop).toHaveBeenCalledOnce();
    expect(song.state().countEndFrame).toBeNull();
    expect(song.start.counting()).toBe(false);
  });

  it('turns the click off as a native stop does', () => {
    const song = counting({ click: true });
    song.start.stop();
    expect(song.releaseClick).toHaveBeenCalledOnce();
    expect(song.state().click).toBe(false);
  });

  it('counts in afresh on the next play', () => {
    const song = counting();
    song.start.stop();
    song.start.play(0);
    expect(song.commands.songCountIn).toHaveBeenCalledOnce();
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
    expect(song.start.counting()).toBe(true);
  });

  it('does nothing with no count pending', () => {
    const song = started({ click: true });
    expect(song.start.stop()).toBe(false);
    expect(song.commands.songStop).not.toHaveBeenCalled();
    expect(song.commands.mixerStop).not.toHaveBeenCalled();
    expect(song.releaseClick).not.toHaveBeenCalled();
  });
});

describe('gridReplaced', () => {
  it('counts in again from the bar start and beat length of the new grid', () => {
    const song = counting({ click: true });
    song.replaceGrid(NEW_BEATS);
    song.start.gridReplaced();
    expect(song.commands.songPause).toHaveBeenCalledOnce();
    expect(song.commands.mixerSeek.mock.calls).toEqual([[0]]);
    const [call] = song.commands.songCountIn.mock.calls;
    expect(call?.[1]).toBeCloseTo(at(NEW_BEAT));
    expect(call?.[3]).toBe(true);
  });

  it('re-counts through followNewGrid once the new grid is stored', async () => {
    const song = counting({ click: true });
    song.replaceGrid(NEW_BEATS);
    await followNewGrid(song.clickContext, song.start.gridReplaced);
    const [call] = song.commands.songCountIn.mock.calls;
    expect(call?.[1]).toBeCloseTo(at(NEW_BEAT));
    expect(song.commands.setGrid).toHaveBeenCalledOnce();
  });

  it('sends nothing with no count pending', () => {
    const song = started();
    song.replaceGrid(NEW_BEATS);
    song.start.gridReplaced();
    expect(song.commands.songPause).not.toHaveBeenCalled();
    expect(song.commands.songCountIn).not.toHaveBeenCalled();
    expect(song.commands.mixerSeek).not.toHaveBeenCalled();
  });
});
