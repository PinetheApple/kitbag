import { KB_SUBDIVISION_BOUNDS } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { previewLedSize } from './rigLeds.ts';

describe('accent row preview', () => {
  it('keeps the design’s LEDs while they fit on one line', () => {
    expect(previewLedSize(4)).toBe('small');
  });

  it('shrinks the LEDs so 16 slots still fit on one line', () => {
    expect(previewLedSize(KB_SUBDIVISION_BOUNDS.max)).toBe('tiny');
  });
});
