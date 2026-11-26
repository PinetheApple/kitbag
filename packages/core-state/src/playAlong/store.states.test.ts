import { KB_METRONOME_SLOT } from '@kitbag/core-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  REANCHOR_INTERVAL_MS,
  SEEK_JUMP_MS,
  SOURCE_GONE_HOLD_MS,
} from './store.ts';
import {
  call,
  fakePlayAlong,
  FRAMES_PER_MS,
  OTHER_ID,
  SESSION_ID,
  snapshot,
  START_MS,
} from './store.test-helper.ts';

const BPM = 120;
const BAR_OFFSET_SEC = 2;
const SONG_SEC = 10;
const REPORT_AFTER_MS = 1000;
const DRIFT_MS = 20;
const SEEK_TO_MS = 40_000;
const SEEK_BACK_MS = 5000;
const MIN_REANCHOR_MS = 1000;
const MAX_REANCHOR_MS = 2000;
const STANDALONE = KB_METRONOME_SLOT.KB_METRONOME_SLOT_STANDALONE;

afterEach(() => {
  vi.useRealTimers();
});

function locked(fake = fakePlayAlong()) {
  fake.store.getState().setBpm(BPM);
  fake.store.getState().tap(START_MS);
  return fake;
}

function reportAt(afterMs: number, overrides = {}) {
  return snapshot({
    positionMs: SONG_SEC * 1000 + afterMs,
    positionUpdatedAtMs: START_MS + afterMs,
    ...overrides,
  });
}

const lastSongSec = (fake: ReturnType<typeof locked>) =>
  fake.anchors().at(-1)?.[0];

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
      SONG_SEC + BAR_OFFSET_SEC + REANCHOR_INTERVAL_MS / 1000,
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

  it('skips while the device is not rendering and retries next tick', () => {
    const fake = fakePlayAlong();
    fake.unmap();
    locked(fake);
    expect(fake.store.getState().lock).toBeDefined();
    vi.advanceTimersByTime(REANCHOR_INTERVAL_MS);
    expect(fake.anchors()).toHaveLength(0);
    fake.map();
    vi.advanceTimersByTime(REANCHOR_INTERVAL_MS);
    expect(fake.anchors()).toHaveLength(1);
    expect(fake.store.getState().lastAnchorAtBoottimeMs).toBe(
      START_MS + 2 * REANCHOR_INTERVAL_MS,
    );
  });

  it('stops re-anchoring once unlocked', () => {
    const fake = locked();
    fake.store.getState().unlock();
    vi.advanceTimersByTime(REANCHOR_INTERVAL_MS * 3);
    expect(fake.anchors()).toHaveLength(1);
  });
});

describe('pause, seek and skip in the other app', () => {
  it('pauses the click and keeps the lock when the song pauses', () => {
    const fake = locked();
    fake.report([reportAt(0, { playing: false, speed: 0 })]);
    fake.report([reportAt(0, { playing: false, speed: 0, title: 'Song' })]);
    expect(fake.commands.metronomePause).toHaveBeenCalledOnce();
    expect(fake.store.getState().lock).toBeDefined();
    vi.advanceTimersByTime(REANCHOR_INTERVAL_MS * 2);
    expect(fake.anchors()).toHaveLength(1);
  });

  it('brings the click back on the beat when the song resumes', () => {
    const fake = locked();
    fake.report([reportAt(0, { playing: false, speed: 0 })]);
    vi.advanceTimersByTime(REPORT_AFTER_MS);
    fake.report([
      snapshot({
        positionMs: SONG_SEC * 1000,
        positionUpdatedAtMs: START_MS + REPORT_AFTER_MS,
      }),
    ]);
    expect(fake.anchors()).toHaveLength(2);
    expect(lastSongSec(fake)).toBeCloseTo(SONG_SEC + BAR_OFFSET_SEC, 9);
  });

  it('re-anchors to the new position after a seek back', () => {
    const fake = locked();
    vi.advanceTimersByTime(REPORT_AFTER_MS);
    fake.report([
      snapshot({
        positionMs: SEEK_BACK_MS,
        positionUpdatedAtMs: START_MS + REPORT_AFTER_MS,
      }),
    ]);
    expect(lastSongSec(fake)).toBeCloseTo(
      SEEK_BACK_MS / 1000 + BAR_OFFSET_SEC,
      9,
    );
  });

  it('re-anchors after a seek forward without calling it drift', () => {
    const fake = locked();
    vi.advanceTimersByTime(REPORT_AFTER_MS);
    fake.report([
      snapshot({
        positionMs: SEEK_TO_MS,
        positionUpdatedAtMs: START_MS + REPORT_AFTER_MS,
      }),
    ]);
    expect(SEEK_TO_MS - SONG_SEC * 1000).toBeGreaterThan(SEEK_JUMP_MS);
    expect(lastSongSec(fake)).toBeCloseTo(
      SEEK_TO_MS / 1000 + BAR_OFFSET_SEC,
      9,
    );
    expect(fake.store.getState().driftMs).toBeUndefined();
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
      'engineRelease()',
    ]);
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
});

describe('drift', () => {
  it('records how far the report sits from our extrapolation', () => {
    const fake = locked();
    vi.advanceTimersByTime(REPORT_AFTER_MS);
    fake.report([
      reportAt(REPORT_AFTER_MS, {
        positionMs: SONG_SEC * 1000 + REPORT_AFTER_MS + DRIFT_MS,
      }),
    ]);
    expect(fake.store.getState().driftMs).toBeCloseTo(DRIFT_MS, 9);
    expect(fake.store.getState().lastAnchorAtBoottimeMs).toBe(
      START_MS + REPORT_AFTER_MS,
    );
  });

  it('does not count a repeat of the same report', () => {
    const fake = locked();
    vi.advanceTimersByTime(REPORT_AFTER_MS);
    fake.report([reportAt(0)]);
    expect(fake.store.getState().driftMs).toBeUndefined();
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
    const fake = fakePlayAlong({
      sessions: [snapshot({ playing: false, speed: 0 })],
    });
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
