import { isUnitySpeed, speedPercentText } from '@kitbag/core-state';

export function miniPlayerDetail(
  artist: string | null,
  click: boolean,
  speed: number,
): string {
  const clickState = click ? 'Click on' : 'Click off';
  const shown = isUnitySpeed(speed)
    ? clickState
    : `${clickState} · ${speedPercentText(speed)}`;
  return artist === null ? shown : `${artist} · ${shown}`;
}
