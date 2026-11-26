import { MS_PER_SECOND } from '@kitbag/core-db';
import { FACT_SEPARATOR } from '@kitbag/core-design';
import { formatClockSeconds } from '@kitbag/core-state';

export const UNKNOWN_TITLE = 'Unknown title';
export const UNKNOWN_ARTIST = 'Unknown artist';

const CLOCK_SEPARATOR = ' / ';

const clock = (ms: number) => formatClockSeconds(ms / MS_PER_SECOND);

export function trackClock(
  positionMs: number | null,
  durationMs: number | null,
): string | null {
  if (positionMs === null) return null;
  if (durationMs === null) return clock(positionMs);
  return (
    clock(Math.min(positionMs, durationMs)) +
    CLOCK_SEPARATOR +
    clock(durationMs)
  );
}

export function artistLead(artist: string | null): string {
  return (artist ?? UNKNOWN_ARTIST) + FACT_SEPARATOR;
}
