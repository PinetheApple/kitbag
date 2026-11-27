import { TEMPO_MAX_BPM, TEMPO_MIN_BPM } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import {
  TAP_WINDOW_INTERVALS,
  TAPS_TO_SET_TEMPO,
} from '../tapTempo/tapTempo.ts';
import {
  manualBpm,
  MANUAL_TEMPO_BOUNDS,
  pushManualTap,
  stepManualBpm,
  tappedManualBpm,
} from './manualTempo.ts';

const MS_PER_MINUTE = 60000;

const tapsAt = (bpm: number, count: number, startMs = 0) =>
  Array.from({ length: count }, (_u, i) => startMs + i * (MS_PER_MINUTE / bpm));

const tapped = (times: readonly number[]) =>
  times.reduce<readonly number[]>((taps, now) => pushManualTap(taps, now), []);

describe('manual tempo bounds', () => {
  it('are the constant-tempo bounds', () => {
    expect(MANUAL_TEMPO_BOUNDS).toEqual({
      min: TEMPO_MIN_BPM,
      max: TEMPO_MAX_BPM,
    });
  });
});

describe('manualBpm', () => {
  it.each([
    [412, TEMPO_MAX_BPM],
    [12, TEMPO_MIN_BPM],
    [127.64, 127.6],
    [127.66, 127.7],
    [128, 128],
  ])('reads %d as %d', (bpm, expected) => {
    expect(manualBpm(bpm)).toBe(expected);
  });
});

describe('stepManualBpm', () => {
  it('moves by a tenth either way', () => {
    expect(stepManualBpm(127.6, 1)).toBe(127.7);
    expect(stepManualBpm(127.6, -1)).toBe(127.5);
  });

  it('lands on exact tenths after many steps', () => {
    let bpm = 120;
    for (let step = 0; step < 3; step += 1) bpm = stepManualBpm(bpm, 1);
    expect(bpm).toBe(120.3);
  });

  it('stops at the range ends', () => {
    expect(stepManualBpm(TEMPO_MAX_BPM, 1)).toBe(TEMPO_MAX_BPM);
    expect(stepManualBpm(TEMPO_MIN_BPM, -1)).toBe(TEMPO_MIN_BPM);
  });
});

describe('tappedManualBpm', () => {
  it('says nothing before the fourth tap', () => {
    expect(tappedManualBpm(tapped(tapsAt(120, TAPS_TO_SET_TEMPO - 1)))).toBe(
      null,
    );
  });

  it('reads one decimal from the fourth tap', () => {
    expect(tappedManualBpm(tapped(tapsAt(127.6, TAPS_TO_SET_TEMPO)))).toBe(
      127.6,
    );
  });

  it('averages every tap of the series, not only the last few', () => {
    const steady = tapsAt(120, TAP_WINDOW_INTERVALS + 1);
    const last = steady.at(-1) ?? 0;
    const slower = tapsAt(100, TAP_WINDOW_INTERVALS + 1, last).slice(1);
    const taps = tapped([...steady, ...slower]);
    expect(taps).toHaveLength(steady.length + slower.length);
    expect(tappedManualBpm(taps)).toBe(109.1);
  });

  it('clamps a tempo tapped outside the range', () => {
    expect(tappedManualBpm(tapped(tapsAt(400, TAPS_TO_SET_TEMPO)))).toBe(
      TEMPO_MAX_BPM,
    );
  });

  it('starts a new series after a pause longer than the slowest beat allows', () => {
    const first = tapsAt(120, TAPS_TO_SET_TEMPO);
    const pauseMs = (MS_PER_MINUTE / TEMPO_MIN_BPM) * 2;
    const later = (first.at(-1) ?? 0) + pauseMs;
    expect(pushManualTap(tapped(first), later)).toEqual([later]);
  });
});
