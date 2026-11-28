import { MS_PER_SECOND } from '@kitbag/core-db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ANCHOR_RETRY_MS,
  REANCHOR_INTERVAL_MS,
  SEEK_JUMP_MS,
  SOURCE_GONE_HOLD_MS,
} from './store.ts';
import {
  BPM,
  call,
  fakePlayAlong,
  FRAMES_PER_MS,
  locked,
  OTHER_ID,
  SESSION_ID,
  snapshot,
  STANDALONE,
  START_MS,
  tapAlongLock,
} from './store.test-helper.ts';

const BAR_OFFSET_SEC = 2;
const SONG_MS = 10_000;
const SONG_SEC = SONG_MS / MS_PER_SECOND;
const REPORT_AFTER_MS = 1000;
const AHEAD_MS = 20;
const SEEK_TO_MS = 40_000;
const SEEK_BACK_MS = 5000;
const MIN_REANCHOR_MS = 1000;
const MAX_REANCHOR_MS = 2000;
const FAST = 1.25;
const TAP_BAR_LINE_SEC = 12;

afterEach(() => {
  vi.useRealTimers();
});

function reportAt(afterMs: number, overrides = {}) {
  return snapshot({
    positionMs: SONG_MS + afterMs,
    positionUpdatedAtMs: START_MS + afterMs,
    ...overrides,
  });
}

const paused = (afterMs: number) =>
  reportAt(afterMs, { playing: false, speed: 0 });

const lastSongSec = (fake: ReturnType<typeof locked>) =>
  fake.anchors().at(-1)?.[0];

const ahead = (fake: ReturnType<typeof locked>) =>
  fake.store.getState().songAheadOfClickMs;

describe('re-anchoring while locked', () => {
  it('re-anchors on a cadence inside the 1 to 2 s window', () => {
    expect(REANCHOR_INTERVAL_MS).toBeGreaterThanOrEqual(MIN_REANCHOR_MS);
    expect(REANCHOR_INTERVAL_MS).toBeLessThanOrEqual(MAX_REANCHOR_MS);
    const fake = locked();
    vi.advanceTimersByTime(REANCHOR_INTERVAL_MS - 1);
    expect(fake.anchors()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(fake.anchors()).toHaveLength(2);
    expect(fake.anchors()[1]).toEqual([
      SONG_SEC + BAR_OFFSET_SEC + REANCHOR_INTERVAL_MS / MS_PER_SECOND,
      (START_MS + REANCHOR_INTERVAL_MS) * FRAMES_PER_MS,
      BPM,
    ]);
    vi.advanceTimersByTime(REANCHOR_INTERVAL_MS);
    expect(fake.anchors()).toHaveLength(3);
  });

  it('re-anchors at once on every new report', () => {
    const fake = locked();
    vi.advanceTimersByTime(REPORT_AFTER_MS);
    fake.report([reportAt(REPORT_AFTER_MS)]);
    expect(fake.anchors()).toHaveLength(2);
  });

  it('retries quickly until the device renders, then keeps the cadence', () => {
    const fake = fakePlayAlong();
    fake.unmap();
    locked(fake);
    expect(fake.store.getState().lock).toBeDefined();
    vi.advanceTimersByTime(ANCHOR_RETRY_MS);
    expect(fake.anchors()).toHaveLength(0);
    fake.map();
    vi.advanceTimersByTime(ANCHOR_RETRY_MS);
    expect(fake.anchors()).toHaveLength(1);
    expect(fake.store.getState().lastAnchorAtBoottimeMs).toBe(
      START_MS + 2 * ANCHOR_RETRY_MS,
    );
    vi.advanceTimersByTime(REANCHOR_INTERVAL_MS - 2 * ANCHOR_RETRY_MS - 1);
    expect(fake.anchors()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(fake.anchors()).toHaveLength(2);
  });

  it('stops retrying once unlocked', () => {
    const fake = fakePlayAlong();
    fake.unmap();
    locked(fake).store.getState().unlock();
    fake.map();
    vi.advanceTimersByTime(REANCHOR_INTERVAL_MS);
    expect(fake.anchors()).toHaveLength(0);
  });

  it('stops re-anchoring once unlocked', () => {
    const fake = locked();
    fake.store.getState().unlock();
    vi.advanceTimersByTime(REANCHOR_INTERVAL_MS * 3);
    expect(fake.anchors()).toHaveLength(1);
  });

  it('runs the click at the song speed', () => {
    const fake = locked(
      fakePlayAlong({ sessions: [snapshot({ speed: FAST })] }),
    );
    const [songSec, , bpm] = fake.anchors()[0] ?? [];
    expect(songSec).toBeCloseTo(TAP_BAR_LINE_SEC / FAST, 9);
    expect(bpm).toBeCloseTo(BPM * FAST, 9);
    vi.advanceTimersByTime(REANCHOR_INTERVAL_MS);
    expect(lastSongSec(fake)).toBeCloseTo(
      (songSec ?? Number.NaN) + REANCHOR_INTERVAL_MS / MS_PER_SECOND,
      9,
    );
    expect(ahead(fake)).toBeCloseTo(0, 9);
  });
});

describe('pause, seek and skip in the other app', () => {
  it('pauses the click and keeps the lock when the song pauses', () => {
    const fake = locked();
    fake.report([paused(0)]);
    fake.report([{ ...paused(0) }]);
    expect(fake.commands.metronomePause).toHaveBeenCalledOnce();
    expect(fake.store.getState().lock).toBeDefined();
    vi.advanceTimersByTime(REANCHOR_INTERVAL_MS * 2);
    expect(fake.anchors()).toHaveLength(1);
  });

  it('brings the click back on the beat when the song resumes', () => {
    const fake = locked();
    fake.report([paused(0)]);
    vi.advanceTimersByTime(REPORT_AFTER_MS);
    fake.report([
      snapshot({
        positionMs: SONG_MS,
        positionUpdatedAtMs: START_MS + REPORT_AFTER_MS,
      }),
    ]);
    expect(fake.anchors()).toHaveLength(2);
    expect(lastSongSec(fake)).toBeCloseTo(SONG_SEC + BAR_OFFSET_SEC, 9);
    expect(ahead(fake)).toBe(0);
  });

  it('re-anchors to the new position after a seek back', () => {
    const fake = locked();
    vi.advanceTimersByTime(REPORT_AFTER_MS);
    fake.report([reportAt(REPORT_AFTER_MS, { positionMs: SEEK_BACK_MS })]);
    expect(lastSongSec(fake)).toBeCloseTo(
      SEEK_BACK_MS / MS_PER_SECOND + BAR_OFFSET_SEC,
      9,
    );
  });

  it('re-anchors after a seek forward without calling it drift', () => {
    const fake = locked();
    vi.advanceTimersByTime(REPORT_AFTER_MS);
    fake.report([reportAt(REPORT_AFTER_MS, { positionMs: SEEK_TO_MS })]);
    expect(SEEK_TO_MS - SONG_MS).toBeGreaterThan(SEEK_JUMP_MS);
    expect(lastSongSec(fake)).toBeCloseTo(
      SEEK_TO_MS / MS_PER_SECOND + BAR_OFFSET_SEC,
      9,
    );
    expect(ahead(fake)).toBe(0);
  });

  it.each([
    ['title', { title: 'Next song' }],
    ['artist', { artist: 'Other band' }],
    ['length', { durationMs: 180_000 }],
  ])('unlocks and stops the click when the %s changes', (_, change) => {
    const fake = locked();
    fake.calls.length = 0;
    fake.report([reportAt(0, change)]);
    expect(fake.store.getState().lock).toBeUndefined();
    expect(fake.calls).toEqual([
      'metronomeStop()',
      call('metronomeSelectSlot', STANDALONE),
      'standaloneReturned()',
      'engineRelease()',
    ]);
  });

  it('keeps the lock when the length arrives late', () => {
    const fake = locked(
      fakePlayAlong({ sessions: [snapshot({ durationMs: null })] }),
    );
    fake.report([reportAt(0)]);
    expect(fake.store.getState().lock?.track.durationMs).toBe(200_000);
    fake.report([reportAt(0, { durationMs: 180_000 })]);
    expect(fake.store.getState().lock).toBeUndefined();
  });
});

describe('the followed app going away', () => {
  it('keeps the last title, silences the click and holds the lock for the grace', () => {
    const fake = locked();
    vi.advanceTimersByTime(REPORT_AFTER_MS);
    fake.report([snapshot({ sessionId: OTHER_ID })]);
    const { lock, sourceGoneAtBoottimeMs } = fake.store.getState();
    expect(lock?.track.title).toBe('Song');
    expect(sourceGoneAtBoottimeMs).toBe(START_MS + REPORT_AFTER_MS);
    expect(fake.commands.metronomePause).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(SOURCE_GONE_HOLD_MS - 1);
    expect(fake.store.getState().lock).toBeDefined();
    expect(fake.anchors()).toHaveLength(1);
  });

  it('drops the lock when the grace runs out', () => {
    const fake = locked();
    fake.report([]);
    vi.advanceTimersByTime(SOURCE_GONE_HOLD_MS);
    expect(fake.store.getState().lock).toBeUndefined();
    expect(fake.store.getState().sourceGoneAtBoottimeMs).toBeUndefined();
    expect(fake.calls).toContain(call('metronomeSelectSlot', STANDALONE));
  });

  it('keeps following when the app comes back inside the grace', () => {
    const fake = locked();
    fake.report([]);
    vi.advanceTimersByTime(SOURCE_GONE_HOLD_MS / 2);
    fake.report([reportAt(SOURCE_GONE_HOLD_MS / 2)]);
    vi.advanceTimersByTime(SOURCE_GONE_HOLD_MS);
    expect(fake.store.getState().lock).toBeDefined();
    expect(fake.store.getState().sourceGoneAtBoottimeMs).toBeUndefined();
    expect(fake.anchors().length).toBeGreaterThan(1);
  });

  it('keeps the lock silent when the app comes back paused inside the grace', () => {
    const fake = locked();
    fake.report([]);
    vi.advanceTimersByTime(SOURCE_GONE_HOLD_MS / 2);
    fake.report([paused(0)]);
    vi.advanceTimersByTime(SOURCE_GONE_HOLD_MS);
    expect(fake.store.getState().lock).toBeDefined();
    expect(fake.store.getState().sourceGoneAtBoottimeMs).toBeUndefined();
    expect(fake.anchors()).toHaveLength(1);
    expect(fake.commands.metronomePause).toHaveBeenCalledOnce();
  });

  it('a grace cut short by an unlock never drops a later lock', () => {
    const fake = locked();
    fake.report([]);
    fake.store.getState().unlock();
    fake.report([reportAt(0)]);
    tapAlongLock(fake);
    vi.advanceTimersByTime(SOURCE_GONE_HOLD_MS);
    expect(fake.store.getState().lock).toBeDefined();
  });
});

describe('how far the song runs ahead of the click', () => {
  it('starts at zero on a fresh lock', () => {
    expect(ahead(locked())).toBe(0);
  });

  it('is the correction an anchor applies, positive when the song is ahead', () => {
    const fake = locked();
    vi.advanceTimersByTime(REPORT_AFTER_MS);
    fake.report([
      reportAt(REPORT_AFTER_MS, {
        positionMs: SONG_MS + REPORT_AFTER_MS + AHEAD_MS,
      }),
    ]);
    expect(ahead(fake)).toBeCloseTo(AHEAD_MS, 9);
    expect(fake.store.getState().lastAnchorAtBoottimeMs).toBe(
      START_MS + REPORT_AFTER_MS,
    );
    fake.report([
      reportAt(REPORT_AFTER_MS, {
        positionMs: SONG_MS + REPORT_AFTER_MS - AHEAD_MS,
      }),
    ]);
    expect(ahead(fake)).toBeCloseTo(-2 * AHEAD_MS, 9);
  });

  it('is zero when steady playback needs no correction', () => {
    const fake = locked();
    vi.advanceTimersByTime(REANCHOR_INTERVAL_MS);
    expect(ahead(fake)).toBeCloseTo(0, 9);
  });
});

describe('the transport keys drive the song', () => {
  it.each([
    ['previous', 'previous'],
    ['next', 'next'],
    ['playPause', 'pause'],
  ] as const)('%s sends %s to the followed app', (action, type) => {
    const fake = locked();
    fake.store.getState()[action]();
    expect(fake.sessionCommand).toHaveBeenCalledWith(SESSION_ID, { type });
  });

  it('plays a paused song', () => {
    const fake = fakePlayAlong({ sessions: [paused(0)] });
    fake.store.getState().playPause();
    expect(fake.sessionCommand).toHaveBeenCalledWith(SESSION_ID, {
      type: 'play',
    });
  });

  it('sends nothing with nothing playing', () => {
    const fake = fakePlayAlong({ sessions: [] });
    fake.store.getState().next();
    expect(fake.sessionCommand).not.toHaveBeenCalled();
  });
});
