import { describe, expect, it } from 'vitest';

import {
  barBounds,
  muteChipValue,
  mutePreview,
  rampChipValue,
  stepWithin,
} from './trainer.ts';

describe('stepWithin', () => {
  it('steps and clamps to the bounds', () => {
    expect(stepWithin(8, 1, barBounds(64))).toBe(9);
    expect(stepWithin(1, -1, barBounds(64))).toBe(1);
    expect(stepWithin(64, 1, barBounds(64))).toBe(64);
    expect(stepWithin(400, 1, { min: 20, max: 400 })).toBe(400);
  });
});

describe('chip values', () => {
  it('draws the ramp as the design does', () => {
    expect(rampChipValue(100, 140)).toBe('100→140');
  });

  it('names both halves of the mute cycle', () => {
    expect(muteChipValue(2, 2)).toBe('2 play · 2 mute');
  });
});

describe('mutePreview', () => {
  it('repeats play bars then mute bars across eight bars', () => {
    expect(mutePreview(2, 2)).toEqual([
      true,
      true,
      false,
      false,
      true,
      true,
      false,
      false,
    ]);
  });

  it('matches the engine cycle for uneven lengths', () => {
    expect(mutePreview(3, 1)).toEqual([
      true,
      true,
      true,
      false,
      true,
      true,
      true,
      false,
    ]);
    expect(mutePreview(1, 16)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});
