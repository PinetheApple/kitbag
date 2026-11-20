import {
  ARRIVAL,
  SKIP,
  SKIPPED_STEM_SONG,
  SKIPPED_UNOPENED_STEM_SONG,
  stemSongTitle,
  type Arrival,
  type Skip,
  type StemSongs,
} from '@kitbag/core-state';

import { SEPARATOR } from '../stemDeck/logic/songFacts.ts';
import { placeLabel, PLAYING } from './playOrderText.ts';

const SKIPPED: Readonly<Record<Skip, string>> = {
  [SKIP.deleted]: SKIPPED_STEM_SONG,
  [SKIP.unopened]: SKIPPED_UNOPENED_STEM_SONG,
};

export function arrivalText(arrival: Arrival, stems: StemSongs): string | null {
  if (arrival.kind === ARRIVAL.arriving) return null;
  if (arrival.kind === ARRIVAL.gaveUp) return SKIPPED_STEM_SONG;
  const { skipped, stemSetId, place } = arrival;
  if (skipped !== null) return SKIPPED[skipped];
  const playing = `${PLAYING} ${stemSongTitle(stemSetId, stems)}`;
  if (place === null) return playing;
  return [playing, placeLabel(place.number, place.of)].join(SEPARATOR);
}
