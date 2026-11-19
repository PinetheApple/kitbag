import { SWIPE_DELETE_FRACTION } from './swipeDeleteRoles.ts';

export type SwipeSide = 'left' | 'right';

export function swipeOffset(translationX: number, side: SwipeSide): number {
  'worklet';
  return side === 'left'
    ? Math.min(0, translationX)
    : Math.max(0, translationX);
}

export function swipeDeletes(
  translationX: number,
  width: number,
  side: SwipeSide,
): boolean {
  'worklet';
  const travelled = Math.abs(swipeOffset(translationX, side));
  return width > 0 && travelled > width * SWIPE_DELETE_FRACTION;
}

export function swipeActivation(
  side: SwipeSide,
  startDp: number,
): [number, number] {
  return side === 'left'
    ? [-startDp, Number.MAX_SAFE_INTEGER]
    : [-Number.MAX_SAFE_INTEGER, startDp];
}
