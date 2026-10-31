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

export const NO_DRAG = -1;

// Rows between the dragged row's start and its target close up by one pitch.
export function neighbourShift(
  index: number,
  from: number,
  target: number,
  rowPitch: number,
): number {
  'worklet';
  if (from === NO_DRAG || index === from) return 0;
  if (from < target && index > from && index <= target) return -rowPitch;
  if (from > target && index < from && index >= target) return rowPitch;
  return 0;
}

export function slotShift(
  index: number,
  from: number,
  target: number,
  rowPitch: number,
): number {
  'worklet';
  if (from === NO_DRAG || index !== from) return 0;
  return (target - from) * rowPitch;
}
