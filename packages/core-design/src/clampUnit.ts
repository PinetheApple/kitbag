export function clampUnit(fraction: number): number {
  'worklet';
  return Math.min(1, Math.max(0, fraction));
}
