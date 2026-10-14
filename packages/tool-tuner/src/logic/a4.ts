// The A4 reference: what the chip shows and how the sheet steps it. Bounds and
// default are the engine's (KB_TUNER_A4_HZ), passed in so this stays headless.

export interface A4Range {
  readonly min: number;
  readonly max: number;
  readonly default: number;
}

export function effectiveA4(a4Hz: number | null, range: A4Range): number {
  return a4Hz ?? range.default;
}

export function stepA4(current: number, delta: number, range: A4Range): number {
  return Math.min(range.max, Math.max(range.min, Math.round(current + delta)));
}

export function a4Label(hz: number): string {
  return `A4 · ${String(hz)} Hz`;
}
