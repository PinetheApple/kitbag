import { FACT_SEPARATOR, placeLabel, PLAYING } from '@kitbag/core-design';
import {
  ARRIVAL,
  queuedSongTitle,
  skippedText,
  type Arrival,
  type LibrarySongs,
} from '@kitbag/core-state';

export function arrivalText(
  arrival: Arrival,
  library: LibrarySongs,
): string | null {
  if (arrival.kind === ARRIVAL.arriving || arrival.kind === ARRIVAL.metronome)
    return null;
  if (arrival.kind === ARRIVAL.gaveUp) return skippedText(arrival.skipped);
  const { skipped, song, place } = arrival;
  if (skipped !== null) return skippedText(skipped);
  if (arrival.inApp) return null;
  const playing = `${PLAYING} ${queuedSongTitle(song, library)}`;
  if (place === null) return playing;
  return [playing, placeLabel(place.number, place.of)].join(FACT_SEPARATOR);
}
