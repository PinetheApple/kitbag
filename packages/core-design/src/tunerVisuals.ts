import { HALF } from './styleConstants.ts';
import type { ColorToken } from './tokens.ts';
import { asPercent } from './percent.ts';

export interface GradientStop {
  readonly token: ColorToken;
  readonly at: number;
}

export const TUNER_STRIP_STOPS: readonly GradientStop[] = [
  { token: 'red', at: 0 },
  { token: 'amber', at: 0.3 },
  { token: 'green', at: 0.47 },
  { token: 'green', at: 0.53 },
  { token: 'amber', at: 0.7 },
  { token: 'red', at: 1 },
];

export const DRIFT_STRIP_SCALE = {
  fullScaleMs: 50,
  inTimeMs: 10,
  offBeatMs: 30,
} as const;

const driftAt = (ms: number) =>
  (DRIFT_STRIP_SCALE.fullScaleMs + ms) / (2 * DRIFT_STRIP_SCALE.fullScaleMs);

export const DRIFT_STRIP_STOPS: readonly GradientStop[] = [
  { token: 'red', at: driftAt(-DRIFT_STRIP_SCALE.fullScaleMs) },
  { token: 'amber', at: driftAt(-DRIFT_STRIP_SCALE.offBeatMs) },
  { token: 'green', at: driftAt(-DRIFT_STRIP_SCALE.inTimeMs) },
  { token: 'green', at: driftAt(DRIFT_STRIP_SCALE.inTimeMs) },
  { token: 'amber', at: driftAt(DRIFT_STRIP_SCALE.offBeatMs) },
  { token: 'red', at: driftAt(DRIFT_STRIP_SCALE.fullScaleMs) },
];

export function stripGradient(
  color: Readonly<Record<ColorToken, string>>,
  gradientStops: readonly GradientStop[],
): string {
  const stops = gradientStops.map(
    ({ token, at }) => `${color[token]} ${asPercent(at)}`,
  );
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

// Non-finite input parks the needle on the centre line rather than at an edge,
// so a missing reading never looks like a badly out-of-tune one.
export function stripPosition(needle: number): number {
  'worklet';
  const reading = Number.isFinite(needle) ? needle : 0;
  return (Math.min(1, Math.max(-1, reading)) + 1) * HALF;
}

/** Which tuning-direction glyph TuneDirectionIcon shows. */
export type TuneGlyph = 'up' | 'down' | 'inTune' | 'none';
