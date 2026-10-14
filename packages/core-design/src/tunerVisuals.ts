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

const CENTRE = 0.5;

// Non-finite input parks the needle on the centre line rather than at an edge,
// so a missing reading never looks like a badly out-of-tune one.
export function stripPosition(needle: number): number {
  'worklet';
  if (!Number.isFinite(needle)) return CENTRE;
  const clamped = Math.min(1, Math.max(-1, needle));
  return (clamped + 1) * CENTRE;
}

export const TUNE_DIRECTION = {
  down: -1,
  inTune: 0,
  up: 1,
  none: Number.NaN,
} as const;

export type TuneGlyph = 'up' | 'down' | 'inTune' | 'none';

export function tuneGlyph(direction: number): TuneGlyph {
  'worklet';
  if (Number.isNaN(direction)) return 'none';
  if (direction > 0) return 'up';
  if (direction < 0) return 'down';
  return 'inTune';
}
