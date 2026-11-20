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
  if (arrival.skipped !== null) return SKIPPED[arrival.skipped];
  if (arrival.stemSetId === null) return null;
  const playing = `${PLAYING} ${stemSongTitle(arrival.stemSetId, stems)}`;
  const { place } = arrival;
  if (place === null) return playing;
  return [playing, `${String(place.number)} of ${String(place.of)}`].join(
    SEPARATOR,
  );
}
