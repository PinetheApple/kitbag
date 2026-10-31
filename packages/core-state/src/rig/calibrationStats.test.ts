import {
  KB_LATENCY_OFFSET_MS_BOUNDS,
  type EngineClockPair,
} from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { CALIBRATION } from './calibrationRules.ts';
import {
  analyseTaps,
  mean,
  storedOffsetMs,
  tapDeviationMs,
  usableDeviations,
} from './calibrationStats.ts';

const RATE = 48_000;
const MS_PER_BEAT = 60_000 / CALIBRATION.bpm;
const FRAMES_PER_BEAT = (RATE * MS_PER_BEAT) / 1000;
const START_FRAME = 96_000;
const PAIR: EngineClockPair = {
  frame: START_FRAME,
  monotonicNs: 5_000_000_000,
  sampleRate: RATE,
};
const START_MS = PAIR.monotonicNs / 1_000_000;
const SCHEDULE = { startFrame: START_FRAME, bpm: CALIBRATION.bpm };

const SPREAD_MS = [-16, -8, 8, 16];

const steady = (offset: number, count: number = CALIBRATION.taps) =>
  Array.from({ length: count }, (_, i) => offset + (i % 2 === 0 ? -2 : 2));

describe('tap deviation', () => {
  it('is positive for a tap after its click', () => {
    expect(
      tapDeviationMs(START_MS + 3 * MS_PER_BEAT + 12, PAIR, SCHEDULE),
    ).toBeCloseTo(12);
  });

  it('is negative for a tap before its click', () => {
    expect(
      tapDeviationMs(START_MS + 5 * MS_PER_BEAT - 40, PAIR, SCHEDULE),
    ).toBeCloseTo(-40);
  });

  it('measures against the nearest click, not the previous one', () => {
    expect(
      tapDeviationMs(
        START_MS + 4 * MS_PER_BEAT + 0.6 * MS_PER_BEAT,
        PAIR,
        SCHEDULE,
      ),
    ).toBeCloseTo(-0.4 * MS_PER_BEAT);
  });

  it('reads click times through a pair stamped later in the run', () => {
    const later: EngineClockPair = {
      frame: START_FRAME + 7 * FRAMES_PER_BEAT + 480,
      monotonicNs: PAIR.monotonicNs + (7 * MS_PER_BEAT + 10) * 1_000_000,
      sampleRate: RATE,
    };
    expect(
      tapDeviationMs(START_MS + 8 * MS_PER_BEAT + 30, later, SCHEDULE),
    ).toBeCloseTo(30);
  });

  it('never measures against a click before the run started', () => {
    expect(tapDeviationMs(START_MS - 100, PAIR, SCHEDULE)).toBeCloseTo(-100);
  });
});

describe('usable taps', () => {
  it('drops a tap further than the window from the run’s median', () => {
    const far = 10 + CALIBRATION.usableWindowMs + 10;
    expect(usableDeviations([...steady(10, 10), far])).toHaveLength(10);
    expect(usableDeviations([...steady(10, 10), 20 - far])).toHaveLength(10);
  });

  it('keeps a tap exactly at the window edge from the median', () => {
    const edge = CALIBRATION.usableWindowMs;
    expect(usableDeviations([0, 0, 0, edge])).toEqual([0, 0, 0, edge]);
  });

  it('measures a route late by nearly the whole window without cutting it short', () => {
    const late = 240;
    const taps = Array.from(
      { length: CALIBRATION.taps },
      (_, i) => late + (SPREAD_MS[i % SPREAD_MS.length] ?? 0),
    );
    const outcome = analyseTaps(taps);
    expect(outcome).toMatchObject({
      kind: 'measured',
      usable: CALIBRATION.taps,
    });
    if (outcome.kind === 'measured')
      expect(outcome.meanMs).toBeCloseTo(late, 0);
  });

  it('drops a tap more than 2.5 SD from the mean', () => {
    const taps = [...steady(20, 15), 120];
    expect(usableDeviations(taps)).toEqual(steady(20, 15));
  });

  it('keeps every tap when they all agree', () => {
    expect(usableDeviations([5, 5, 5, 5])).toEqual([5, 5, 5, 5]);
  });
});

describe('calibration result', () => {
  it('is the mean deviation with the sample SD', () => {
    const outcome = analyseTaps([10, 12, 14, 10, 12, 14, 10, 12, 14, 12]);
    expect(outcome.kind).toBe('measured');
    if (outcome.kind !== 'measured') return;
    expect(outcome.meanMs).toBeCloseTo(12);
    expect(outcome.sdMs).toBeCloseTo(Math.sqrt(24 / 9), 5);
    expect(outcome.usable).toBe(10);
  });

  it('refuses with fewer than 8 usable taps', () => {
    const taps = steady(12, CALIBRATION.minUsableTaps - 1);
    expect(analyseTaps(taps)).toEqual({
      kind: 'refused',
      reason: 'too-few',
      usable: CALIBRATION.minUsableTaps - 1,
    });
  });

  it('produces a number with exactly 8 usable taps', () => {
    expect(analyseTaps(steady(12, CALIBRATION.minUsableTaps)).kind).toBe(
      'measured',
    );
  });

  it('is steady with an SD at the threshold and unsteady above it', () => {
    const spread = (sd: number) => {
      const half = sd * Math.sqrt((CALIBRATION.taps - 1) / CALIBRATION.taps);
      return Array.from({ length: CALIBRATION.taps }, (_, i) =>
        i % 2 === 0 ? -half : half,
      );
    };
    const at = analyseTaps(spread(CALIBRATION.steadySdMs));
    const above = analyseTaps(spread(CALIBRATION.steadySdMs + 1));
    expect(at).toMatchObject({ kind: 'measured', steady: true });
    expect(above).toMatchObject({ kind: 'measured', steady: false });
  });
});

describe('stored offset', () => {
  it('rounds to the stepper’s 1 ms', () => {
    expect(storedOffsetMs(12.4)).toBe(12);
    expect(storedOffsetMs(-12.6)).toBe(-13);
  });
});

describe('sign against the engine', () => {
  const emittedMs = (gridMs: number, offsetMs: number) => gridMs - offsetMs;

  it('makes a late route sound on the beat once applied', () => {
    const outputLatencyMs = 40;
    const grid = Array.from(
      { length: CALIBRATION.taps },
      (_, i) => START_MS + (i + 1) * MS_PER_BEAT,
    );
    const taps = grid.map((g, i) =>
      tapDeviationMs(
        g + outputLatencyMs + (i % 2 === 0 ? -1 : 1),
        PAIR,
        SCHEDULE,
      ),
    );
    const outcome = analyseTaps(taps);
    if (outcome.kind !== 'measured') throw new Error('expected a result');
    const offsetMs = storedOffsetMs(outcome.meanMs);
    expect(offsetMs).toBe(outputLatencyMs);
    const heardMs = emittedMs(grid[0] ?? 0, offsetMs) + outputLatencyMs;
    expect(heardMs).toBeCloseTo(grid[0] ?? 0);
  });
});

describe('at the wrap', () => {
  const ROUTE_SD_MS = 25;
  const NORMAL_SCORES = [
    -1.53, -1.15, -0.89, -0.67, -0.49, -0.32, -0.16, 0, 0, 0.16, 0.32, 0.49,
    0.67, 0.89, 1.15, 1.53,
  ];
  const tapsFor = (trueMs: number) =>
    NORMAL_SCORES.map((z, i) =>
      tapDeviationMs(
        START_MS + (i + 1) * MS_PER_BEAT + trueMs + z * ROUTE_SD_MS,
        PAIR,
        SCHEDULE,
      ),
    );

  it('sees taps on both sides of the wrap for a route near it', () => {
    const taps = tapsFor(290);
    expect(taps.some((d) => d > 0)).toBe(true);
    expect(taps.some((d) => d < 0)).toBe(true);
  });

  it.each([290, -290])(
    'measures a %d ms route across the wrap with its own sign',
    (trueMs) => {
      const usable = usableDeviations(tapsFor(trueMs));
      expect(usable).toHaveLength(CALIBRATION.taps);
      expect(mean(usable)).toBeCloseTo(trueMs, 0);
    },
  );

  it.each([290, -290])(
    'refuses a %d ms route whose spread crosses the limit',
    (trueMs) => {
      expect(analyseTaps(tapsFor(trueMs))).toMatchObject({
        kind: 'refused',
        reason: 'at-limit',
      });
    },
  );

  it('refuses a 320 ms route as past the limit', () => {
    expect(analyseTaps(tapsFor(320))).toMatchObject({
      kind: 'refused',
      reason: 'at-limit',
    });
  });

  it('refuses an even split across the wrap rather than averaging it to zero', () => {
    const edge = MS_PER_BEAT / 2 - 5;
    const split = Array.from({ length: CALIBRATION.taps }, (_, i) =>
      i % 2 === 0 ? edge : -edge,
    );
    expect(analyseTaps(split)).toMatchObject({ kind: 'refused' });
  });

  it('never measures a value it could not store', () => {
    for (let trueMs = -MS_PER_BEAT; trueMs <= MS_PER_BEAT; trueMs += 5) {
      const outcome = analyseTaps(tapsFor(trueMs));
      if (outcome.kind !== 'measured') continue;
      const stored = storedOffsetMs(outcome.meanMs);
      expect(stored).toBeGreaterThanOrEqual(KB_LATENCY_OFFSET_MS_BOUNDS.min);
      expect(stored).toBeLessThanOrEqual(KB_LATENCY_OFFSET_MS_BOUNDS.max);
    }
  });
});
