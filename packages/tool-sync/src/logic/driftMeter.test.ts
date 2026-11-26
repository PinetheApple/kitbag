import { MS_PER_SECOND } from '@kitbag/core-db';
import { DRIFT_STRIP_SCALE } from '@kitbag/core-design';
import { SOURCE_GONE_HOLD_MS } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  DRIFT_STATE,
  driftMeterView,
  isDrifting,
  type DriftInputs,
} from './driftMeter.ts';

const LOCKED_AT_MS = 1000;
const MINUTE_TWELVE_MS = 72 * MS_PER_SECOND;
const SMALL_DRIFT_MS = 2.4;
const BIG_DRIFT_MS = 38;
const EARLY_DRIFT_MS = -12;
const JUST_OVER_IN_TIME_MS = 10.4;
const GONE_AT_MS = 50_000;
const THREE_SECONDS_GONE_MS = 3 * MS_PER_SECOND;
const PART_OF_A_SECOND_MS = 400;

const quiet: DriftInputs = {
  lockedAtMs: LOCKED_AT_MS,
  songAheadOfClickMs: SMALL_DRIFT_MS,
  playing: true,
  sourceGoneAtMs: undefined,
  appLabel: 'Spotify',
  nowMs: LOCKED_AT_MS + MINUTE_TWELVE_MS,
};

const whenText = (view: ReturnType<typeof driftMeterView>) =>
  view.lead + (view.figures ?? '') + view.tail;

describe('driftMeterView', () => {
  it('stays quiet inside ±10 ms and says how long ago it locked', () => {
    const view = driftMeterView(quiet);
    expect(view.state).toBe(DRIFT_STATE.locked);
    expect(view.badge).toEqual({ label: 'LOCKED', tone: 'success' });
    expect(whenText(view)).toBe('Locked · 1:12 ago');
    expect(view.figures).toBe('1:12');
    expect(view.reading).toBe('+2 ms');
    expect(view.muted).toBe(false);
    expect(view.controls).toBe(true);
  });

  it('turns to drift outside ±10 ms and says so in words, not only colour', () => {
    const view = driftMeterView({ ...quiet, songAheadOfClickMs: BIG_DRIFT_MS });
    expect(view.state).toBe(DRIFT_STATE.drift);
    expect(view.badge).toEqual({ label: 'DRIFT', tone: 'warning' });
    expect(whenText(view)).toBe('Off by more than 10 ms');
    expect(view.reading).toBe('+38 ms');
    expect(view.needle).toBeCloseTo(
      BIG_DRIFT_MS / DRIFT_STRIP_SCALE.fullScaleMs,
    );
    expect(view.controls).toBe(false);
  });

  it('signs an early click with a minus', () => {
    const view = driftMeterView({
      ...quiet,
      songAheadOfClickMs: EARLY_DRIFT_MS,
    });
    expect(view.reading).toBe('−12 ms');
    expect(view.needle).toBeLessThan(0);
  });

  it('reads zero before the first re-anchor has measured anything', () => {
    const view = driftMeterView({ ...quiet, songAheadOfClickMs: undefined });
    expect(view.state).toBe(DRIFT_STATE.locked);
    expect(view.reading).toBe('0 ms');
    expect(view.needle).toBe(0);
  });

  it('keeps the badge while paused and greys the strip', () => {
    const view = driftMeterView({
      ...quiet,
      songAheadOfClickMs: BIG_DRIFT_MS,
      playing: false,
    });
    expect(view.state).toBe(DRIFT_STATE.paused);
    expect(view.badge).toEqual({ label: 'LOCKED', tone: 'success' });
    expect(whenText(view)).toBe('Paused · resumes on the beat');
    expect(view.reading).toBe('0 ms');
    expect(view.needle).toBe(0);
    expect(view.muted).toBe(true);
  });

  it('counts the hold down once the followed app went away', () => {
    const view = driftMeterView({
      ...quiet,
      sourceGoneAtMs: GONE_AT_MS,
      nowMs: GONE_AT_MS + THREE_SECONDS_GONE_MS,
    });
    expect(view.state).toBe(DRIFT_STATE.holding);
    expect(view.badge).toEqual({ label: 'HOLDING', tone: 'warning' });
    expect(whenText(view)).toBe('Spotify stopped · holding 7 s');
    expect(view.figures).toBe('7');
    expect(view.muted).toBe(true);
    expect(view.controls).toBe(true);
  });

  it('counts a started second as a whole one and never below zero', () => {
    const partWay = driftMeterView({
      ...quiet,
      sourceGoneAtMs: GONE_AT_MS,
      nowMs: GONE_AT_MS + PART_OF_A_SECOND_MS,
    });
    expect(partWay.figures).toBe(String(SOURCE_GONE_HOLD_MS / MS_PER_SECOND));
    const over = driftMeterView({
      ...quiet,
      sourceGoneAtMs: GONE_AT_MS,
      nowMs: GONE_AT_MS + SOURCE_GONE_HOLD_MS + MS_PER_SECOND,
    });
    expect(over.figures).toBe('0');
  });
});

describe('drift decided on the shown reading', () => {
  it('stays locked at 10.4 ms, which reads as +10 ms', () => {
    const view = driftMeterView({
      ...quiet,
      songAheadOfClickMs: JUST_OVER_IN_TIME_MS,
    });
    expect(view.state).toBe(DRIFT_STATE.locked);
    expect(view.reading).toBe('+10 ms');
  });
});

describe('re-tap', () => {
  it('is offered only while the click sounds in time', () => {
    expect(driftMeterView(quiet).retapEnabled).toBe(true);
    const paused = driftMeterView({ ...quiet, playing: false });
    expect(paused.controls).toBe(true);
    expect(paused.retapEnabled).toBe(false);
    const holding = driftMeterView({ ...quiet, sourceGoneAtMs: GONE_AT_MS });
    expect(holding.controls).toBe(true);
    expect(holding.retapEnabled).toBe(false);
  });
});

describe('isDrifting', () => {
  it('is quiet up to the in-time band and drifting past it', () => {
    expect(isDrifting(DRIFT_STRIP_SCALE.inTimeMs)).toBe(false);
    expect(isDrifting(-DRIFT_STRIP_SCALE.inTimeMs - 1)).toBe(true);
    expect(isDrifting(undefined)).toBe(false);
  });
});
