import { FACT_SEPARATOR, placeLabel, PLAYING } from '@kitbag/core-design';
import {
  ARRIVAL,
  queuedSongTitle,
  SKIP,
  SKIPPED_STEM_SONG,
  SKIPPED_UNOPENED_STEM_SONG,
  type Arrival,
  type LibrarySongs,
  type Skip,
} from '@kitbag/core-state';

const SKIPPED: Readonly<Record<Skip, string>> = {
  [SKIP.deleted]: SKIPPED_STEM_SONG,
  [SKIP.unopened]: SKIPPED_UNOPENED_STEM_SONG,
};

export function arrivalText(
  arrival: Arrival,
  library: LibrarySongs,
): string | null {
  if (arrival.kind === ARRIVAL.arriving || arrival.kind === ARRIVAL.metronome)
    return null;
  if (arrival.kind === ARRIVAL.gaveUp) return SKIPPED_STEM_SONG;
  const { skipped, song, place } = arrival;
  if (skipped !== null) return SKIPPED[skipped];
  const playing = `${PLAYING} ${queuedSongTitle(song, library)}`;
  if (place === null) return playing;
  return [playing, placeLabel(place.number, place.of)].join(FACT_SEPARATOR);
}
