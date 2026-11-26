import { describe, expect, it } from 'vitest';

import {
  barSeconds,
  engineSongSeconds,
  extrapolatedPositionMs,
} from './position.ts';
import { snapshot, START_MS } from './store.test-helper.ts';

const LATER_MS = 400;
const HALF_SPEED = 0.5;

describe('extrapolating the other app position', () => {
  it('runs the reported position on at the reported speed while playing', () => {
    const report = snapshot({ positionMs: 10_000, speed: HALF_SPEED });
    expect(extrapolatedPositionMs(report, START_MS + LATER_MS)).toBe(
      10_000 + LATER_MS * HALF_SPEED,
    );
  });

  it('holds a paused position still', () => {
    const report = snapshot({ playing: false, speed: 0 });
    expect(extrapolatedPositionMs(report, START_MS + LATER_MS)).toBe(10_000);
  });

  it('is unknown when the app reports no position', () => {
    const report = snapshot({ positionMs: null });
    expect(extrapolatedPositionMs(report, START_MS + LATER_MS)).toBeNull();
  });
});

describe('the bar the engine counts', () => {
  it.each([
    [120, 4, 4, 2],
    [120, 3, 4, 1.5],
    [120, 6, 8, 1.5],
    [120, 7, 8, 1.75],
    [90, 5, 4, 10 / 3],
  ])('%d bpm in %d/%d lasts %d s', (bpm, beats, denominator, seconds) => {
    expect(barSeconds(bpm, beats, denominator)).toBeCloseTo(seconds, 9);
  });

  it('puts the tapped downbeat on a non-negative bar line', () => {
    const bar = barSeconds(120, 7, 8);
    const at = engineSongSeconds(10.3, 10.3, bar);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(at / bar).toBeCloseTo(Math.round(at / bar), 9);
  });

  it('keeps a song position before the downbeat non-negative', () => {
    expect(engineSongSeconds(0, 10.3, 2)).toBeGreaterThanOrEqual(0);
  });
});
