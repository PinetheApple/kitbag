import {
  SKIP,
  SKIPPED_STEM_SONG,
  SKIPPED_UNOPENED_STEM_SONG,
  stemSongTitle,
  type Arrival,
  type Skip,
  type StemSongs,
} from '@kitbag/core-state';

import { SEPARATOR } from '../stemDeck/logic/songFacts.ts';

const PLAYING = 'Playing';

const SKIPPED: Readonly<Record<Skip, string>> = {
  [SKIP.deleted]: SKIPPED_STEM_SONG,
  [SKIP.unopened]: SKIPPED_UNOPENED_STEM_SONG,
};

export function arrivalText(arrival: Arrival, stems: StemSongs): string | null {
  const { skipped, stemSetId } = arrival;
  if (!arrival.played)
    return stemSetId === null && skipped === SKIP.deleted
      ? SKIPPED_STEM_SONG
      : null;
  if (skipped !== null) return SKIPPED[skipped];
  if (stemSetId === null) return null;
  const playing = `${PLAYING} ${stemSongTitle(stemSetId, stems)}`;
  const { place } = arrival;
  if (place === null) return playing;
  return [playing, `${String(place.number)} of ${String(place.of)}`].join(
    SEPARATOR,
  );
}
