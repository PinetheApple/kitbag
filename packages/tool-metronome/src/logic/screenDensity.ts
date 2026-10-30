export type ScreenDensity = 'roomy' | 'compact';

export function screenDensity(
  windowHeight: number,
  compactBelowHeight: number,
): ScreenDensity {
  return windowHeight < compactBelowHeight ? 'compact' : 'roomy';
}
