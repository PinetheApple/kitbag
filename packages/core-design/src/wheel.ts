export function wheelIndex(
  offsetDp: number,
  pitchDp: number,
  count: number,
): number {
  return Math.min(Math.max(Math.round(offsetDp / pitchDp), 0), count - 1);
}

export function steppedIndex(
  index: number,
  delta: number,
  count: number,
): number {
  return Math.min(Math.max(index + delta, 0), count - 1);
}
