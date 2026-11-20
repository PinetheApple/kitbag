export type CountSquareState = 'done' | 'now' | 'upcoming';

export function countSquareState(
  beat: number,
  currentBeat: number,
): CountSquareState {
  'worklet';
  if (beat < currentBeat) return 'done';
  return beat === currentBeat ? 'now' : 'upcoming';
}
