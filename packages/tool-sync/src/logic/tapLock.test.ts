import { TEMPO_MAX_BPM, TEMPO_MIN_BPM } from '@kitbag/core-db';
import { TAPS_TO_SET_TEMPO } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  BEAT_SOURCE,
  downbeatForBeat,
  downbeatFromTap,
  tapLock,
  TAP_AGREE_MS,
  TAP_LOCK_MISS,
  TAP_LOCK_WINDOW,
  TAP_OUTLIER_MS,
  TEMPO_AGREE_TOLERANCE,
  TEMPO_DISAGREE_TOLERANCE,
  type TapLocked,
  type TapLockResult,
} from './tapLock.ts';

const MS_PER_MINUTE = 60000;
const QUARTER = 4;
const START_MS = 10000;
const TRUE_PHASE_MS = 137;
const BPM = 120;
const BEAT_MS = MS_PER_MINUTE / BPM;
const PHASE_TOLERANCE_MS = 3;
const BPM_TOLERANCE = 0.5;
const JITTER = [20, -30, 0, 10, -10, 30, 0, -20];
const BAD_TAP_INDEX = 3;
const BAD_TAP_OFFSETS_MS = [200, -200, 240, -240];
const BEATS_PER_BAR = 4;
const SONG = { bpm: BPM, denominator: QUARTER };
const NO_SONG_BPM = { bpm: null, denominator: QUARTER };

const tapsAt = (
  bpm: number,
  phaseMs: number,
  jitter: readonly number[],
): number[] =>
  jitter.map(
    (offset, beat) =>
      START_MS + phaseMs + beat * (MS_PER_MINUTE / bpm) + offset,
  );

const steady = (count: number): number[] => new Array<number>(count).fill(0);

const offBeatBy = (ms: number, truthMs: number, beatMs: number): number => {
  const diff = ms - truthMs;
  return Math.abs(diff - beatMs * Math.round(diff / beatMs));
};

function expectLocked(result: TapLockResult): TapLocked {
  if (!result.locked) throw new Error(`not locked: ${result.reason}`);
  return result;
}

describe('tapLock phase', () => {
  const truth = START_MS + TRUE_PHASE_MS;

  for (const badMs of BAD_TAP_OFFSETS_MS)
    for (const song of [SONG, NO_SONG_BPM])
      it(`ignores one tap ${String(badMs)} ms off (song bpm ${String(song.bpm)})`, () => {
        const clean = tapsAt(BPM, TRUE_PHASE_MS, JITTER);
        const withBad = clean.map((t, i) =>
          i === BAD_TAP_INDEX ? t + badMs : t,
        );
        const without = clean.filter((_t, i) => i !== BAD_TAP_INDEX);
        const bad = expectLocked(tapLock(withBad, song));
        const good = expectLocked(tapLock(without, song));
        expect(Math.abs(bad.anchorMs - good.anchorMs)).toBeLessThanOrEqual(
          PHASE_TOLERANCE_MS,
        );
        expect(Math.abs(bad.bpm - good.bpm)).toBeLessThanOrEqual(BPM_TOLERANCE);
        expect(offBeatBy(bad.anchorMs, truth, BEAT_MS)).toBeLessThanOrEqual(
          PHASE_TOLERANCE_MS,
        );
      });

  it('averages around the circle when taps straddle the beat', () => {
    const nearZero = 5;
    const jitter = [-20, 15, -10, 20, -15, 10, 0, -5];
    const lock = expectLocked(
      tapLock(tapsAt(BPM, nearZero - START_MS, jitter), SONG),
    );
    expect(offBeatBy(lock.anchorMs, nearZero, BEAT_MS)).toBeLessThanOrEqual(
      PHASE_TOLERANCE_MS,
    );
  });

  it('anchors next to the newest tap', () => {
    const taps = tapsAt(BPM, TRUE_PHASE_MS, JITTER);
    const lock = expectLocked(tapLock(taps, SONG));
    expect(Math.abs(lock.anchorMs - (taps.at(-1) ?? 0))).toBeLessThan(
      BEAT_MS / 2,
    );
  });

  it('decides the phase from the newest taps only', () => {
    const older = TAP_LOCK_WINDOW + 2;
    const offBeat = BEAT_MS / 2;
    const jitter = [
      ...steady(older).map(() => offBeat),
      ...steady(TAP_LOCK_WINDOW),
    ];
    const lock = expectLocked(
      tapLock(tapsAt(BPM, TRUE_PHASE_MS, jitter), SONG),
    );
    expect(offBeatBy(lock.anchorMs, truth, BEAT_MS)).toBeLessThanOrEqual(
      PHASE_TOLERANCE_MS,
    );
  });

  it('keeps the click on the taps when the tempo is rounded to a tenth', () => {
    const tappedBpm = 97.37;
    const lateInSongMs = 170000;
    const tenths = 10;
    const taps = tapsAt(tappedBpm, lateInSongMs, steady(TAP_LOCK_WINDOW));
    const lock = expectLocked(tapLock(taps, NO_SONG_BPM));
    const roundedBeatMs =
      MS_PER_MINUTE / (Math.round(lock.bpm * tenths) / tenths);
    for (const tap of taps)
      expect(offBeatBy(tap, lock.anchorMs, roundedBeatMs)).toBeLessThan(2);
  });
});

describe('tapLock tempo', () => {
  it('reads the tempo from the taps when the track has none', () => {
    const slower = 96;
    const lock = expectLocked(
      tapLock(tapsAt(slower, TRUE_PHASE_MS, JITTER), NO_SONG_BPM),
    );
    expect(lock.beatSource).toBe(BEAT_SOURCE.taps);
    expect(Math.abs(lock.bpm - slower)).toBeLessThanOrEqual(BPM_TOLERANCE);
  });

  it('survives a skipped beat', () => {
    const taps = tapsAt(BPM, TRUE_PHASE_MS, [0, 10, -10, 0, 10, -10]);
    taps.splice(2, 1);
    const lock = expectLocked(tapLock(taps, NO_SONG_BPM));
    expect(Math.abs(lock.bpm - BPM)).toBeLessThanOrEqual(BPM_TOLERANCE);
  });

  it('ignores a double tap', () => {
    const doubleTapMs = 40;
    const taps = tapsAt(BPM, TRUE_PHASE_MS, [0, 10, -10, 0, 10, -10, 0]);
    taps.splice(BAD_TAP_INDEX, 0, (taps[BAD_TAP_INDEX - 1] ?? 0) + doubleTapMs);
    const lock = expectLocked(tapLock(taps, NO_SONG_BPM));
    expect(Math.abs(lock.bpm - BPM)).toBeLessThanOrEqual(BPM_TOLERANCE);
  });

  it('keeps the song tempo when the taps agree with it', () => {
    const songBpm = BPM * (1 + TEMPO_AGREE_TOLERANCE / 2);
    const lock = expectLocked(
      tapLock(tapsAt(BPM, 0, [0, 5, -5, 0, 5, -5]), { ...SONG, bpm: songBpm }),
    );
    expect(lock.beatSource).toBe(BEAT_SOURCE.song);
    expect(lock.bpm).toBe(songBpm);
  });

  it('keeps the song tempo when the taps are at half or double time', () => {
    const taps = tapsAt(BPM, 0, steady(TAP_LOCK_WINDOW));
    const half = expectLocked(tapLock(taps, { ...SONG, bpm: BPM / 2 }));
    const double = expectLocked(tapLock(taps, { ...SONG, bpm: BPM * 2 }));
    expect(half.bpm).toBe(BPM / 2);
    expect(double.bpm).toBe(BPM * 2);
  });

  it('puts the beat on the half of double-time taps the first tap was on', () => {
    const songBpm = BPM / 2;
    const songBeatMs = MS_PER_MINUTE / songBpm;
    const onBeat = START_MS;
    const taps = tapsAt(BPM, BEAT_MS, steady(TAP_LOCK_WINDOW));
    const lock = expectLocked(tapLock(taps, { ...SONG, bpm: songBpm }));
    expect(lock.gridMs).toBeCloseTo(BEAT_MS);
    expect(
      offBeatBy(lock.anchorMs, onBeat + BEAT_MS, songBeatMs),
    ).toBeLessThanOrEqual(1);
    const lateOne = 20;
    const downbeat = downbeatFromTap(lock, onBeat + songBeatMs * 2 + lateOne);
    expect(offBeatBy(downbeat, onBeat, songBeatMs)).toBeLessThanOrEqual(1);
  });

  it('says the taps disagree with a song tempo well off them', () => {
    const songBpm = BPM * (1 + TEMPO_DISAGREE_TOLERANCE * 2);
    const result = tapLock(tapsAt(BPM, 0, steady(TAP_LOCK_WINDOW)), {
      ...SONG,
      bpm: songBpm,
    });
    expect(result).toMatchObject({
      locked: false,
      reason: TAP_LOCK_MISS.disagrees,
    });
  });

  it('asks for more taps between agreeing and disagreeing', () => {
    const between = (TEMPO_AGREE_TOLERANCE + TEMPO_DISAGREE_TOLERANCE) / 2;
    const result = tapLock(tapsAt(BPM, 0, steady(TAP_LOCK_WINDOW)), {
      ...SONG,
      bpm: BPM * (1 + between),
    });
    expect(result).toMatchObject({
      locked: false,
      reason: TAP_LOCK_MISS.unsure,
    });
  });

  it('refuses a tapped tempo outside the tempo range', () => {
    const tooFast = tapLock(
      tapsAt(TEMPO_MAX_BPM * 2, 0, steady(TAP_LOCK_WINDOW)),
      NO_SONG_BPM,
    );
    const tooSlow = tapLock(
      tapsAt(TEMPO_MIN_BPM / 2, 0, steady(TAP_LOCK_WINDOW)),
      NO_SONG_BPM,
    );
    expect(tooFast).toMatchObject({
      locked: false,
      reason: TAP_LOCK_MISS.outOfRange,
    });
    expect(tooSlow).toMatchObject({
      locked: false,
      reason: TAP_LOCK_MISS.outOfRange,
    });
  });
});

describe('tapLock refusals', () => {
  it('needs enough taps', () => {
    const result = tapLock(tapsAt(BPM, 0, steady(TAPS_TO_SET_TEMPO - 1)), SONG);
    expect(result).toMatchObject({
      locked: false,
      reason: TAP_LOCK_MISS.tooFew,
    });
  });

  it('refuses taps that wander too much and says how far', () => {
    const wide = (TAP_AGREE_MS + TAP_OUTLIER_MS) / 2;
    const jitter = steady(TAP_LOCK_WINDOW).map((_z, i) =>
      i % 2 === 0 ? wide : -wide,
    );
    const result = tapLock(tapsAt(BPM, TRUE_PHASE_MS, jitter), SONG);
    expect(result).toMatchObject({
      locked: false,
      reason: TAP_LOCK_MISS.spread,
      spreadMs: wide,
    });
  });

  it('calls plenty of scattered taps a spread, not too few', () => {
    const far = TAP_OUTLIER_MS * 2 - TAP_AGREE_MS;
    const scatter = [0, 0, 0, far, -far, far, -far, far];
    const result = tapLock(tapsAt(BPM, TRUE_PHASE_MS, scatter), SONG);
    expect(result).toMatchObject({
      locked: false,
      reason: TAP_LOCK_MISS.spread,
    });
  });
});

describe('downbeat choice', () => {
  const grid = { anchorMs: TRUE_PHASE_MS, beatMs: BEAT_MS, gridMs: BEAT_MS };

  it('snaps a tap on the 1 to the nearest beat of the lock', () => {
    const beat = 6;
    const lateBy = 40;
    expect(
      downbeatFromTap(grid, TRUE_PHASE_MS + beat * BEAT_MS + lateBy),
    ).toBeCloseTo(TRUE_PHASE_MS + beat * BEAT_MS);
  });

  it('wraps a beat index into the bar', () => {
    expect(downbeatForBeat(grid, BEATS_PER_BAR, -1)).toBeCloseTo(
      TRUE_PHASE_MS + (BEATS_PER_BAR - 1) * BEAT_MS,
    );
  });
});
