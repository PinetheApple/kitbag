import { describe, expect, it } from 'vitest';

import {
  BEAT_SOURCE,
  barOffsetForBeat,
  downbeatFromTap,
  tapLock,
  TAP_LOCK_MISS,
  TAP_LOCK_WINDOW,
  type TapLockResult,
} from './tapLock.ts';

const MS_PER_MINUTE = 60000;
const START_MS = 10000;
const TRUE_PHASE_MS = 137;
const BPM = 120;
const BEAT_MS = MS_PER_MINUTE / BPM;
const PHASE_TOLERANCE_MS = 5;
const BPM_TOLERANCE = 1;
const OUTLIER_MS = 120;
const JITTER_WITH_OUTLIER = [20, -30, OUTLIER_MS, 10, -10, 30, 0, -20];
const BEATS_PER_BAR = 4;

const tapsAt = (
  bpm: number,
  phaseMs: number,
  jitter: readonly number[],
): number[] =>
  jitter.map(
    (offset, beat) =>
      START_MS + phaseMs + beat * (MS_PER_MINUTE / bpm) + offset,
  );

const beatError = (phaseMs: number, truthMs: number, beatMs: number) => {
  const diff = phaseMs - truthMs;
  return Math.abs(diff - beatMs * Math.round(diff / beatMs));
};

function expectLocked(result: TapLockResult) {
  if (!result.locked) throw new Error(`not locked: ${result.reason}`);
  return result;
}

describe('tapLock phase', () => {
  it('locks within a few ms of the beat despite one late tap', () => {
    const taps = tapsAt(BPM, TRUE_PHASE_MS, JITTER_WITH_OUTLIER);
    const lock = expectLocked(tapLock(taps, BPM));
    expect(
      beatError(lock.phaseMs, START_MS + TRUE_PHASE_MS, BEAT_MS),
    ).toBeLessThanOrEqual(PHASE_TOLERANCE_MS);
    expect(lock.keptTaps).toBe(JITTER_WITH_OUTLIER.length - 1);
  });

  it('averages around the circle when taps straddle the beat', () => {
    const nearZero = 5;
    const jitter = [-20, 15, -10, 20, -15, 10, 0, -5];
    const lock = expectLocked(
      tapLock(tapsAt(BPM, nearZero - START_MS, jitter), BPM),
    );
    expect(beatError(lock.phaseMs, nearZero, BEAT_MS)).toBeLessThanOrEqual(
      PHASE_TOLERANCE_MS,
    );
    expect(lock.phaseMs).toBeGreaterThanOrEqual(0);
    expect(lock.phaseMs).toBeLessThan(BEAT_MS);
  });

  it('keeps only the newest taps of a long series', () => {
    const offBeat = BEAT_MS / 2;
    const early = tapsAt(BPM, TRUE_PHASE_MS + offBeat, [0, 0, 0, 0]);
    const late = tapsAt(
      BPM,
      TRUE_PHASE_MS,
      new Array<number>(TAP_LOCK_WINDOW).fill(0),
    );
    const lock = expectLocked(
      tapLock([...early, ...late.map((t) => t + MS_PER_MINUTE)], BPM),
    );
    expect(lock.phaseMs).toBeCloseTo((START_MS + TRUE_PHASE_MS) % BEAT_MS);
  });
});

describe('tapLock tempo', () => {
  it('reads the tempo from the taps when the track has none', () => {
    const slower = 96;
    const lock = expectLocked(
      tapLock(tapsAt(slower, TRUE_PHASE_MS, JITTER_WITH_OUTLIER), null),
    );
    expect(lock.beatSource).toBe(BEAT_SOURCE.taps);
    expect(Math.abs(lock.bpm - slower)).toBeLessThanOrEqual(BPM_TOLERANCE);
  });

  it('survives a skipped beat', () => {
    const taps = tapsAt(BPM, TRUE_PHASE_MS, [0, 10, -10, 0, 10, -10]);
    taps.splice(2, 1);
    const lock = expectLocked(tapLock(taps, null));
    expect(Math.abs(lock.bpm - BPM)).toBeLessThanOrEqual(BPM_TOLERANCE);
  });

  it('keeps the song tempo when the taps agree with it', () => {
    const songBpm = 121;
    const lock = expectLocked(
      tapLock(tapsAt(BPM, 0, [0, 5, -5, 0, 5, -5]), songBpm),
    );
    expect(lock.beatSource).toBe(BEAT_SOURCE.song);
    expect(lock.bpm).toBe(songBpm);
  });

  it('keeps the song tempo when the taps are at half or double time', () => {
    const steady = [0, 0, 0, 0, 0, 0];
    const half = expectLocked(tapLock(tapsAt(BPM, 0, steady), BPM / 2));
    const double = expectLocked(tapLock(tapsAt(BPM, 0, steady), BPM * 2));
    expect(half.bpm).toBe(BPM / 2);
    expect(double.bpm).toBe(BPM * 2);
  });

  it('says the taps disagree with a song tempo well off them', () => {
    const result = tapLock(tapsAt(BPM, 0, [0, 0, 0, 0, 0]), 128);
    expect(result).toMatchObject({
      locked: false,
      reason: TAP_LOCK_MISS.disagrees,
    });
  });

  it('asks for more taps when the tempo is between agreeing and disagreeing', () => {
    const result = tapLock(tapsAt(BPM, 0, [0, 0, 0, 0, 0]), 126);
    expect(result).toMatchObject({
      locked: false,
      reason: TAP_LOCK_MISS.unsure,
    });
  });
});

describe('tapLock refusals', () => {
  it('needs four taps', () => {
    const result = tapLock(tapsAt(BPM, 0, [0, 0, 0]), BPM);
    expect(result).toMatchObject({
      locked: false,
      reason: TAP_LOCK_MISS.tooFew,
    });
  });

  it('refuses taps that wander too much and says how far', () => {
    const wide = 45;
    const result = tapLock(
      tapsAt(BPM, TRUE_PHASE_MS, [
        wide,
        -wide,
        wide,
        -wide,
        wide,
        -wide,
        wide,
        -wide,
      ]),
      BPM,
    );
    expect(result).toMatchObject({
      locked: false,
      reason: TAP_LOCK_MISS.spread,
      spreadMs: wide,
    });
  });
});

describe('downbeat choice', () => {
  const grid = { phaseMs: TRUE_PHASE_MS, beatMs: BEAT_MS };

  it('snaps a tap on the 1 to the nearest beat of the lock', () => {
    const beat = 6;
    const lateBy = 40;
    const pick = downbeatFromTap(
      grid,
      BEATS_PER_BAR,
      TRUE_PHASE_MS + beat * BEAT_MS + lateBy,
    );
    expect(pick.beatIndex).toBe(beat % BEATS_PER_BAR);
    expect(pick.barOffsetMs).toBeCloseTo(
      TRUE_PHASE_MS + (beat % BEATS_PER_BAR) * BEAT_MS,
    );
  });

  it('wraps a beat index into the bar', () => {
    expect(barOffsetForBeat(grid, BEATS_PER_BAR, -1)).toBeCloseTo(
      TRUE_PHASE_MS + (BEATS_PER_BAR - 1) * BEAT_MS,
    );
  });
});
