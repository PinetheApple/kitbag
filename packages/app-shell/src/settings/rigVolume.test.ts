import { KB_VOLUME_BOUNDS } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  fractionOfVolume,
  VOLUME_SLIDER,
  volumeOfFraction,
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
