export const PLAYING = 'Playing';

export function placeLabel(number: number, of: number): string {
  return `${String(number)} of ${String(of)}`;
}
