export const TEMPO_CORRECTION = {
  half: 'half',
  twoThirds: 'twoThirds',
  none: 'none',
  threeHalves: 'threeHalves',
  double: 'double',
} as const;
export type TempoCorrection =
  (typeof TEMPO_CORRECTION)[keyof typeof TEMPO_CORRECTION];
export const TEMPO_CORRECTIONS = Object.values(TEMPO_CORRECTION) as [
  TempoCorrection,
  ...TempoCorrection[],
];

export interface TempoRatio {
  readonly beatsOut: number;
  readonly beatsIn: number;
}

export const TEMPO_RATIO: Readonly<Record<TempoCorrection, TempoRatio>> = {
  half: { beatsOut: 1, beatsIn: 2 },
  twoThirds: { beatsOut: 2, beatsIn: 3 },
  none: { beatsOut: 1, beatsIn: 1 },
  threeHalves: { beatsOut: 3, beatsIn: 2 },
  double: { beatsOut: 2, beatsIn: 1 },
};

export function isTempoCorrection(value: unknown): value is TempoCorrection {
  return TEMPO_CORRECTIONS.some((correction) => correction === value);
}

export function tempoCorrectionOf(stored: string | null): TempoCorrection {
  return isTempoCorrection(stored) ? stored : TEMPO_CORRECTION.none;
}

export function storedTempoCorrection(
  correction: TempoCorrection,
): TempoCorrection | null {
  return correction === TEMPO_CORRECTION.none ? null : correction;
}
