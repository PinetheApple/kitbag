import { FACT_SEPARATOR, nextUpLabel, placeLabel } from '@kitbag/core-design';
import {
  isUnitySpeed,
  speedPercentText,
  type SetlistPlace,
} from '@kitbag/core-state';

export interface SetlistSpot extends SetlistPlace {
  readonly setlistName: string;
}

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

function whereFrom(spot: SetlistSpot | null, next: string | null): string[] {
  if (spot !== null)
    return [spot.setlistName, placeLabel(spot.number, spot.of)];
  return next === null ? [] : [nextUpLabel(next)];
}

export function stemMiniPlayerDetail(
  artist: string | null,
  spot: SetlistSpot | null,
  next: string | null,
): string {
  return [artist, ...whereFrom(spot, next)]
    .filter((part) => part !== null && part !== '')
    .join(FACT_SEPARATOR);
}
