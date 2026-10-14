import { HALF } from './styleConstants.ts';
import type { ColorToken } from './tokens.ts';

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

const PERCENT = 100;

export function tunerStripGradient(
  color: Readonly<Record<ColorToken, string>>,
): string {
  const stops = TUNER_STRIP_STOPS.map(
    ({ token, at }) => `${color[token]} ${String(at * PERCENT)}%`,
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
