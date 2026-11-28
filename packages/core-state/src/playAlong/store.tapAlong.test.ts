import { MS_PER_SECOND } from '@kitbag/core-db';

import { BPM_SOURCE } from '../tempoLadder/sources.ts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ONE_SET_SHOWN_MS, TAP_STEP, TAPS_CLEARED } from './tapAlongState.ts';
import { BEAT_SOURCE, TAP_LOCK_MISS, TAP_LOCK_WINDOW } from './tapLock.ts';
import { BPM, fakePlayAlong, snapshot, START_MS } from './store.test-helper.ts';

const SONG_START_MS = 10_000;
const LEAD_MS = 300;
const BEAT_MS = 500;
const BAR_MS = 2000;
const FOUR = 4;
const STOP_MS = 1000;
const SLOW_BPM = 60;
const SLOW_STOP_MS = 2000;
const HALF_TIME_GAP_MS = 1000;
const DOUBLE_TIME_GAP_MS = 250;
const DISAGREE_GAP_MS = 600;
const DISAGREE_BPM = 100;
const UNSURE_GAP_MS = BEAT_MS / 1.05;
const LATE_MS = 30;
const NEAR_MS = 40;
const PAUSE_MS = 5000;
const SEEK_TO_MS = 60_000;
const ONE_DECIMAL = 1;
const FIRST_DOWNBEAT_SONG_MS = 12_300;
const PAST_EIGHTH = 10;
const OUTLIER_MS = 100;
const UNSURE_BPM = 126;

type Fake = ReturnType<typeof fakePlayAlong>;

afterEach(() => {
  vi.useRealTimers();
});

const songMsAt = (atMs: number) => SONG_START_MS + atMs - START_MS;
const atSongMs = (songMs: number) => START_MS + songMs - SONG_START_MS;

function tapAt(fake: Fake, atMs: number) {
  vi.advanceTimersByTime(atMs - Date.now());
  return fake.store.getState().tapToLock(atMs);
}

function tapEvery(
  fake: Fake,
  gapMs: number,
  count: number,
  fromMs = START_MS + LEAD_MS,
) {
  for (let tap = 0; tap < count; tap += 1) tapAt(fake, fromMs + tap * gapMs);
}

function songAt(bpm: number | null = BPM) {
  const fake = fakePlayAlong();
  if (bpm === null) fake.store.setState({ bpm: undefined });
  else fake.store.getState().setBpm(bpm);
  return fake;
}

function lockedFromTaps() {
  const fake = songAt();
  tapEvery(fake, BEAT_MS, FOUR);
  vi.advanceTimersByTime(STOP_MS);
  return fake;
}

const downbeatInBar = (fake: Fake) => {
  const sec = fake.store.getState().lock?.downbeatSec ?? Number.NaN;
  return (((sec * MS_PER_SECOND) % BAR_MS) + BAR_MS) % BAR_MS;
};

describe('tap along', () => {
  it('collects taps in song time and does not lock while tapping', () => {
    const fake = songAt();
    tapEvery(fake, BEAT_MS, FOUR);
    const { tapAlong, lock } = fake.store.getState();
    expect(lock).toBeUndefined();
    expect(tapAlong.taps).toEqual(
      [0, 1, 2, 3].map((beat) => songMsAt(START_MS + LEAD_MS + beat * BEAT_MS)),
    );
    expect(tapAlong.offsets).toHaveLength(FOUR);
    expect(fake.anchors()).toEqual([]);
  });

  it('locks once tapping stops for two beats and at least a second', () => {
    const fake = songAt();
    tapEvery(fake, BEAT_MS, FOUR);
    vi.advanceTimersByTime(STOP_MS - 1);
    expect(fake.store.getState().lock).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(fake.store.getState().lock?.bpm).toBe(BPM);
    expect(fake.store.getState().tapAlong.taps).toEqual([]);
  });

  it('waits two of the tapped beats at a slow tempo', () => {
    const fake = songAt(SLOW_BPM);
    tapEvery(fake, SLOW_STOP_MS / 2, FOUR);
    vi.advanceTimersByTime(SLOW_STOP_MS - 1);
    expect(fake.store.getState().lock).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(fake.store.getState().lock?.bpm).toBe(SLOW_BPM);
  });

  it('locks at the eighth kept tap without waiting', () => {
    const fake = songAt();
    tapEvery(fake, BEAT_MS, TAP_LOCK_WINDOW - 1);
    expect(fake.store.getState().lock).toBeUndefined();
    tapAt(fake, START_MS + LEAD_MS + (TAP_LOCK_WINDOW - 1) * BEAT_MS);
    expect(fake.store.getState().lock?.bpm).toBe(BPM);
  });

  it('puts beat 1 on the first tap and then asks for the 1', () => {
    const fake = lockedFromTaps();
    const { lock, tapAlong } = fake.store.getState();
    expect(downbeatInBar(fake)).toBeCloseTo(LEAD_MS, ONE_DECIMAL);
    expect(lock?.tapped).toEqual({
      beatSource: BEAT_SOURCE.song,
      keptTaps: FOUR,
    });
    expect(tapAlong.step).toBe(TAP_STEP.chooseOne);
  });

  it('takes the tempo from the taps when the song has none', () => {
    const fake = songAt(null);
    tapEvery(fake, DISAGREE_GAP_MS, FOUR);
    vi.advanceTimersByTime(2 * DISAGREE_GAP_MS);
    const { lock, bpm } = fake.store.getState();
    expect(lock?.bpm).toBeCloseTo(DISAGREE_BPM, ONE_DECIMAL);
    expect(bpm).toBe(lock?.bpm);
    expect(lock?.tapped).toEqual({
      beatSource: BEAT_SOURCE.taps,
      keptTaps: FOUR,
    });
  });
});

describe('taps against a known tempo', () => {
  it('keeps the song tempo silently for half-time taps', () => {
    const fake = songAt();
    tapEvery(fake, HALF_TIME_GAP_MS, FOUR);
    vi.advanceTimersByTime(2 * HALF_TIME_GAP_MS);
    const { lock, tapAlong } = fake.store.getState();
    expect(lock?.bpm).toBe(BPM);
    expect(tapAlong.step).toBe(TAP_STEP.chooseOne);
    expect(tapAlong.halfOrDoubleBpm).toBeCloseTo(BPM / 2, ONE_DECIMAL);
  });

  it('keeps the song tempo silently for double-time taps', () => {
    const fake = songAt();
    tapEvery(fake, DOUBLE_TIME_GAP_MS, TAP_LOCK_WINDOW);
    const { lock, tapAlong } = fake.store.getState();
    expect(lock?.bpm).toBe(BPM);
    expect(tapAlong.halfOrDoubleBpm).toBeCloseTo(BPM * 2, ONE_DECIMAL);
  });

  it('asks once which tempo to use when the taps disagree', () => {
    const fake = songAt();
    tapEvery(fake, DISAGREE_GAP_MS, FOUR);
    vi.advanceTimersByTime(2 * DISAGREE_GAP_MS);
    const { lock, tapAlong } = fake.store.getState();
    expect(lock?.bpm).toBe(BPM);
    expect(tapAlong.step).toBe(TAP_STEP.chooseTempo);
    expect(tapAlong.tempoChoice).toMatchObject({
      songBpm: BPM,
      keptTaps: FOUR,
    });
    expect(tapAlong.tempoChoice?.tappedBpm).toBeCloseTo(
      DISAGREE_BPM,
      ONE_DECIMAL,
    );
  });

  it('uses the tapped tempo when chosen, then asks for the 1', () => {
    const fake = songAt();
    tapEvery(fake, DISAGREE_GAP_MS, FOUR);
    vi.advanceTimersByTime(2 * DISAGREE_GAP_MS);
    fake.store.getState().chooseTappedTempo();
    const { lock, tapAlong } = fake.store.getState();
    expect(lock?.bpm).toBeCloseTo(DISAGREE_BPM, ONE_DECIMAL);
    expect(lock?.tapped?.beatSource).toBe(BEAT_SOURCE.taps);
    expect(tapAlong.step).toBe(TAP_STEP.chooseOne);
  });

  it('keeps the song tempo when chosen, then asks for the 1', () => {
    const fake = songAt();
    tapEvery(fake, DISAGREE_GAP_MS, FOUR);
    vi.advanceTimersByTime(2 * DISAGREE_GAP_MS);
    fake.store.getState().chooseSongTempo();
    expect(fake.store.getState().lock?.bpm).toBe(BPM);
    expect(fake.store.getState().tapAlong.step).toBe(TAP_STEP.chooseOne);
  });

  it('asks for more taps when they are only slightly off', () => {
    const fake = songAt();
    tapEvery(fake, UNSURE_GAP_MS, FOUR);
    vi.advanceTimersByTime(2 * BEAT_MS);
    const { lock, tapAlong } = fake.store.getState();
    expect(lock).toBeUndefined();
    expect(tapAlong.result).toMatchObject({ reason: TAP_LOCK_MISS.unsure });
    expect(tapAlong.taps).toHaveLength(FOUR);
  });
});

describe('taps through pauses, seeks and track changes', () => {
  function pausedAt(fake: Fake, atMs: number) {
    vi.advanceTimersByTime(atMs - Date.now());
    fake.report([
      snapshot({
        playing: false,
        positionMs: songMsAt(atMs),
        positionUpdatedAtMs: atMs,
      }),
    ]);
  }

  it('keeps taps through a pause and locks once tapping carries on', () => {
    const fake = songAt();
    tapEvery(fake, BEAT_MS, FOUR);
    const pauseAt = Date.now() + BEAT_MS / 2;
    pausedAt(fake, pauseAt);
    vi.advanceTimersByTime(PAUSE_MS);
    expect(fake.store.getState().tapToLock(Date.now())).toBe(false);
    expect(fake.store.getState().lock).toBeUndefined();
    expect(fake.store.getState().tapAlong.taps).toHaveLength(FOUR);
    const resumeAt = Date.now();
    fake.report([
      snapshot({
        positionMs: songMsAt(pauseAt),
        positionUpdatedAtMs: resumeAt,
      }),
    ]);
    tapAt(fake, resumeAt + BEAT_MS / 2);
    expect(fake.store.getState().tapAlong.taps).toHaveLength(FOUR + 1);
    vi.advanceTimersByTime(STOP_MS);
    expect(fake.store.getState().lock?.bpm).toBe(BPM);
  });

  it('clears the taps on a seek', () => {
    const fake = songAt();
    tapEvery(fake, BEAT_MS, 2);
    fake.report([
      snapshot({ positionMs: SEEK_TO_MS, positionUpdatedAtMs: Date.now() }),
    ]);
    expect(fake.store.getState().tapAlong).toMatchObject({
      taps: [],
      cleared: TAPS_CLEARED.seek,
    });
  });

  it('clears the taps on a track change', () => {
    const fake = songAt();
    tapEvery(fake, BEAT_MS, 2);
    fake.report([snapshot({ title: 'Next song' })]);
    expect(fake.store.getState().tapAlong).toMatchObject({
      taps: [],
      cleared: TAPS_CLEARED.track,
    });
    vi.advanceTimersByTime(STOP_MS);
    expect(fake.store.getState().lock).toBeUndefined();
  });

  it('keeps the taps through ordinary position reports', () => {
    const fake = songAt();
    tapEvery(fake, BEAT_MS, 2);
    fake.report([
      snapshot({
        positionMs: songMsAt(Date.now()),
        positionUpdatedAtMs: Date.now(),
      }),
    ]);
    expect(fake.store.getState().tapAlong.taps).toHaveLength(2);
  });

  it('starts over on request', () => {
    const fake = songAt();
    tapEvery(fake, BEAT_MS, 2);
    fake.store.getState().startTapsOver();
    expect(fake.store.getState().tapAlong.taps).toEqual([]);
  });
});

describe('choose the 1', () => {
  it('moves beat 1 to the beat nearest a tap on the 1', () => {
    const fake = lockedFromTaps();
    tapAt(fake, atSongMs(FIRST_DOWNBEAT_SONG_MS + 2 * BEAT_MS + NEAR_MS));
    const { lock, tapAlong } = fake.store.getState();
    expect(lock?.downbeatShift).toBe(0);
    expect(downbeatInBar(fake)).toBeCloseTo(LEAD_MS + 2 * BEAT_MS, ONE_DECIMAL);
    expect(tapAlong).toMatchObject({ step: TAP_STEP.oneSet, movedBeats: 2 });
    vi.advanceTimersByTime(ONE_SET_SHOWN_MS);
    expect(fake.store.getState().tapAlong.step).toBe(TAP_STEP.tapping);
  });

  it('leaves the accent alone when it is already right', () => {
    const fake = lockedFromTaps();
    fake.store.getState().keepAccent();
    expect(fake.store.getState().tapAlong.step).toBe(TAP_STEP.tapping);
    expect(fake.store.getState().lock?.downbeatShift).toBe(0);
  });

  it('asks for the 1 again on request', () => {
    const fake = lockedFromTaps();
    fake.store.getState().keepAccent();
    fake.store.getState().askForOne();
    expect(fake.store.getState().tapAlong.step).toBe(TAP_STEP.chooseOne);
  });

  it('takes taps that carry on past an eighth-tap lock as tapping, not the 1', () => {
    const fake = songAt();
    tapEvery(fake, BEAT_MS, PAST_EIGHTH);
    const { lock, tapAlong } = fake.store.getState();
    expect(tapAlong.step).toBe(TAP_STEP.chooseOne);
    expect(lock?.downbeatShift).toBe(0);
    expect(downbeatInBar(fake)).toBeCloseTo(LEAD_MS, ONE_DECIMAL);
  });

  it('takes a tap on the 1 once the tapping has paused', () => {
    const fake = songAt();
    tapEvery(fake, BEAT_MS, TAP_LOCK_WINDOW);
    const lastTapSongMs = songMsAt(Date.now());
    tapAt(fake, atSongMs(lastTapSongMs + 2 * BAR_MS + 2 * BEAT_MS));
    expect(fake.store.getState().tapAlong).toMatchObject({
      step: TAP_STEP.oneSet,
      movedBeats: 1,
    });
  });

  it('keeps beat 1 on the very first tap after the oldest taps are dropped', () => {
    const fake = songAt();
    for (let tap = 0; tap < PAST_EIGHTH; tap += 1) {
      const late = tap === 1 ? OUTLIER_MS : 0;
      tapAt(fake, START_MS + LEAD_MS + tap * BEAT_MS + late);
    }
    expect(fake.store.getState().lock).toBeDefined();
    expect(downbeatInBar(fake)).toBeCloseTo(LEAD_MS, ONE_DECIMAL);
  });

  it('never asks for the 1 without a lock', () => {
    const fake = songAt();
    fake.store.getState().askForOne();
    expect(fake.store.getState().tapAlong.step).toBe(TAP_STEP.tapping);
  });
});

describe('the tempo ladder', () => {
  it('is told a tempo taken from the taps, as tapped', () => {
    const fake = songAt(null);
    tapEvery(fake, DISAGREE_GAP_MS, FOUR);
    vi.advanceTimersByTime(2 * DISAGREE_GAP_MS);
    const bpm = fake.store.getState().lock?.bpm;
    expect(fake.ladder.ladder.getState().enter).toHaveBeenLastCalledWith(
      bpm,
      BPM_SOURCE.tap,
    );
  });

  it('is told the tapped tempo once it is chosen over the song', () => {
    const fake = songAt();
    tapEvery(fake, DISAGREE_GAP_MS, FOUR);
    vi.advanceTimersByTime(2 * DISAGREE_GAP_MS);
    fake.store.getState().chooseTappedTempo();
    expect(fake.ladder.ladder.getState().enter).toHaveBeenLastCalledWith(
      fake.store.getState().lock?.bpm,
      BPM_SOURCE.tap,
    );
  });

  it('keeps the song tempo credited when the taps only set the phase', () => {
    const fake = lockedFromTaps();
    expect(fake.ladder.ladder.getState().enter).not.toHaveBeenCalledWith(
      BPM,
      BPM_SOURCE.tap,
    );
  });
});

describe('steady taps a little off the song', () => {
  it('ask once which tempo to use after eight steady taps', () => {
    const fake = songAt();
    tapEvery(fake, UNSURE_GAP_MS, TAP_LOCK_WINDOW);
    const { lock, tapAlong } = fake.store.getState();
    expect(lock?.bpm).toBe(BPM);
    expect(tapAlong.step).toBe(TAP_STEP.chooseTempo);
    expect(tapAlong.tempoChoice?.tappedBpm).toBeCloseTo(UNSURE_BPM, 0);
  });
});

describe('per-tap badges', () => {
  it('mark the same taps kept as the lock counts', () => {
    const fake = songAt();
    for (let tap = 0; tap < FOUR + 1; tap += 1) {
      const late = tap === 2 ? OUTLIER_MS : 0;
      tapAt(fake, START_MS + LEAD_MS + tap * BEAT_MS + late);
    }
    const { offsets, result } = fake.store.getState().tapAlong;
    const keptTaps = result?.locked === true ? result.keptTaps : Number.NaN;
    expect(offsets.filter((offset) => offset.kept)).toHaveLength(keptTaps);
  });
});

describe('re-tap', () => {
  it('re-aligns the phase and keeps the tempo and the 1 without asking', () => {
    const fake = lockedFromTaps();
    fake.store.getState().keepAccent();
    const from = atSongMs(
      FIRST_DOWNBEAT_SONG_MS + 2 * BAR_MS + BEAT_MS + LATE_MS,
    );
    tapEvery(fake, BEAT_MS, FOUR, from);
    vi.advanceTimersByTime(STOP_MS);
    const { lock, tapAlong } = fake.store.getState();
    expect(lock?.bpm).toBe(BPM);
    expect(lock?.downbeatShift).toBe(0);
    expect(downbeatInBar(fake)).toBeCloseTo(LEAD_MS + LATE_MS, ONE_DECIMAL);
    expect(tapAlong.step).toBe(TAP_STEP.tapping);
  });

  it('keeps a beat 1 moved by Beat ‹ › and Reset leaves it there', () => {
    const fake = lockedFromTaps();
    fake.store.getState().keepAccent();
    fake.store.getState().shiftDownbeat(1);
    fake.store.getState().shiftDownbeat(1);
    const from = atSongMs(
      FIRST_DOWNBEAT_SONG_MS + 2 * BAR_MS + BEAT_MS + LATE_MS,
    );
    tapEvery(fake, BEAT_MS, FOUR, from);
    vi.advanceTimersByTime(STOP_MS);
    const moved = LEAD_MS + 2 * BEAT_MS + LATE_MS;
    expect(fake.store.getState().lock?.downbeatShift).toBe(0);
    expect(downbeatInBar(fake)).toBeCloseTo(moved, ONE_DECIMAL);
    fake.store.getState().resetPhase();
    expect(downbeatInBar(fake)).toBeCloseTo(moved, ONE_DECIMAL);
  });

  it('drops re-tap taps when re-tap ends before they lock', () => {
    const fake = lockedFromTaps();
    fake.store.getState().keepAccent();
    const lockedAt = fake.store.getState().lock?.lockedAtBoottimeMs;
    tapEvery(fake, BEAT_MS, FOUR, Date.now() + BAR_MS);
    fake.store.getState().dropRetapTaps();
    vi.advanceTimersByTime(STOP_MS);
    expect(fake.store.getState().tapAlong.taps).toEqual([]);
    expect(fake.store.getState().lock?.lockedAtBoottimeMs).toBe(lockedAt);
  });
});
