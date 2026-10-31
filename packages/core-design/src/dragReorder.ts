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

export function dropTarget(
  from: number,
  translationY: number,
  rowPitch: number,
  count: number,
  completed: boolean,
): number | null {
  'worklet';
  if (!completed) return null;
  const to = reorderTarget(from, translationY, rowPitch, count);
  return to === from ? null : to;
}
