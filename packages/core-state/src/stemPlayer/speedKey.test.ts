import { STEM_SET_PITCH } from '@kitbag/core-db';
import {
  KB_MIXER_PITCH_BOUNDS,
  KB_MIXER_RATE_BOUNDS,
  KB_MIXER_UNITY_RATE,
} from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  SPEED_PRESETS,
  speedPercent,
  steppedKey,
  steppedSpeed,
  transposable,
  wholeKey,
} from './speedKey.ts';

describe('speed steps', () => {
  it.each([
    [1, -1, 0.95],
    [0.75, 1, 0.8],
    [0.73, 1, 0.8],
    [KB_MIXER_RATE_BOUNDS.min, -1, KB_MIXER_RATE_BOUNDS.min],
    [KB_MIXER_UNITY_RATE, 1, KB_MIXER_UNITY_RATE],
  ])('%f stepped by %i plays at %f', (speed, steps, expected) => {
    expect(steppedSpeed(speed, steps)).toBe(expected);
  });

  it('offers presets the engine can play, slowest first', () => {
    expect(SPEED_PRESETS.map(speedPercent)).toEqual([50, 75, 90, 100]);
    for (const preset of SPEED_PRESETS) {
      expect(preset).toBeGreaterThanOrEqual(KB_MIXER_RATE_BOUNDS.min);
      expect(preset).toBeLessThanOrEqual(KB_MIXER_RATE_BOUNDS.max);
    }
  });
});

describe('key steps', () => {
  it.each([
    [0, 1, 1],
    [KB_MIXER_PITCH_BOUNDS.max, 1, KB_MIXER_PITCH_BOUNDS.max],
    [KB_MIXER_PITCH_BOUNDS.min, -1, KB_MIXER_PITCH_BOUNDS.min],
  ])('%i stepped by %i is %i', (key, steps, expected) => {
    expect(steppedKey(key, steps)).toBe(expected);
  });

  it('reads a stored key as whole semitones, half away from zero', () => {
    expect(wholeKey(-2.5)).toBe(-3);
    expect(wholeKey(2.5)).toBe(3);
    expect(wholeKey(-0.4)).toBe(0);
  });

  it('stores the song key in the range the engine plays', () => {
    expect([STEM_SET_PITCH.min, STEM_SET_PITCH.max]).toEqual([
      KB_MIXER_PITCH_BOUNDS.min,
      KB_MIXER_PITCH_BOUNDS.max,
    ]);
  });
});

describe('drum stems', () => {
  it.each(['drums', 'Drums', ' drums '])('never transposes %j', (role) => {
    expect(transposable(role)).toBe(false);
  });

  it('transposes every other stem', () => {
    expect(transposable('bass')).toBe(true);
  });
});
