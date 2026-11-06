import { KB_SUBDIVISION_BOUNDS } from '@kitbag/core-native';

import { RIG_CLICK_BPM } from './rigClickRules.ts';

export const CALIBRATION = {
  bpm: RIG_CLICK_BPM,
  subdivision: KB_SUBDIVISION_BOUNDS.min,
  taps: 16,
  minUsableTaps: 8,
  usableWindowMs: 250,
  maxAbsZ: 2.5,
  steadySdMs: 30,
  engineJumpMs: 50,
} as const;
