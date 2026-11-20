import {
  FACT_SEPARATOR,
  nextUpLabel,
  setlistPlaceParts,
} from '@kitbag/core-design';
import {
  isUnitySpeed,
  speedPercentText,
  type SetlistSpot,
} from '@kitbag/core-state';

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
  if (spot !== null) return setlistPlaceParts(spot);
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
