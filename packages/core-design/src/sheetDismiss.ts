export const SHEET_DISMISS_DRAG_FRACTION = 0.25;
export const SHEET_DRAG_ACTIVATION_DP = 8;

export function shouldDismissSheet(
  translationY: number,
  sheetHeight: number,
): boolean {
  'worklet';
  if (sheetHeight <= 0) return false;
  return translationY > sheetHeight * SHEET_DISMISS_DRAG_FRACTION;
}
