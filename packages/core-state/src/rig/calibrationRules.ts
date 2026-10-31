import { KB_SUBDIVISION_BOUNDS } from '@kitbag/core-native';

export const CALIBRATION = {
  bpm: 100,
  subdivision: KB_SUBDIVISION_BOUNDS.min,
  taps: 16,
  minUsableTaps: 8,
  maxClickDistanceMs: 250,
  maxAbsZ: 2.5,
  steadySdMs: 30,
  scatterSdSpan: 3,
  minScatterHalfRangeMs: 50,
  engineJumpMs: 50,
} as const;
