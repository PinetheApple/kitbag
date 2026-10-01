export function reorderTarget(
  from: number,
  translationY: number,
  rowPitch: number,
  count: number,
): number {
  'worklet';
  if (rowPitch <= 0) return from;
  const target = from + Math.round(translationY / rowPitch);
  return Math.min(Math.max(target, 0), count - 1);
}
