export const NOT_FOUND = -1;

export function lastAtOrBefore<K extends string>(
  sorted: readonly Readonly<Record<K, number>>[],
  key: K,
  value: number,
): number {
  'worklet';
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if ((sorted[mid]?.[key] ?? Infinity) <= value) low = mid + 1;
    else high = mid;
  }
  return low + NOT_FOUND;
}
