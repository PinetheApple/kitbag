import { KB_VOLUME_BOUNDS } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  fractionOfVolume,
  VOLUME_SLIDER,
  volumeOfFraction,
  volumePercent,
} from './rigVolume.ts';

describe('click volume slider', () => {
  it('puts unity at the centre of the range', () => {
    expect(VOLUME_SLIDER.detent.at).toBe(0.5);
    expect(volumeOfFraction(VOLUME_SLIDER.detent.at)).toBe(1);
  });

  it('catches within 3% of the range either side of unity', () => {
    expect(VOLUME_SLIDER.detent.reach * KB_VOLUME_BOUNDS.max).toBeCloseTo(0.06);
  });

  it('turns red only past 150%', () => {
    expect(volumeOfFraction(VOLUME_SLIDER.warnAbove)).toBe(1.5);
  });

  it('maps a volume back to the same slider position', () => {
    expect(fractionOfVolume(volumeOfFraction(0.3))).toBeCloseTo(0.3);
  });
});

describe('click volume readout', () => {
  it('reads out a whole percentage, red or not', () => {
    expect(volumePercent(1)).toBe('100%');
    expect(volumePercent(1.7)).toBe('170%');
    expect(volumePercent(0.004)).toBe('0%');
  });
});
