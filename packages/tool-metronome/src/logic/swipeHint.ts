export function showSwipeHint(
  hintSeen: boolean,
  zoneHeight: number,
  summaryShown: boolean,
): boolean {
  return !hintSeen && zoneHeight > 0 && !summaryShown;
}
