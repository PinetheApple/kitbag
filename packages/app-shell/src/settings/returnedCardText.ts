import { countLabel } from '@kitbag/core-design';
import type { DataFolderVolume } from '@kitbag/core-native';
import type { LibraryView } from '@kitbag/core-state';

import { SONG_NOUNS, viewCountLabel } from '../nouns.ts';
import { formatBytes } from './bytes.ts';
import { capitalised } from './capitalised.ts';
import {
  CARD_PLACE,
  thePlace,
  THE_CARD,
  type RowValue,
} from './dataFolderText.ts';
import { SEPARATOR } from './separator.ts';

export const CARD_BACK_TITLE = `${capitalised(CARD_PLACE)} is back`;
export const STILL_ON_CARD = `Still on ${THE_CARD}`;
export const RETURN_OFFER_HINTS = [
  'Left on the card when you switched to internal storage.',
  'Kitbag copies and checks them, then removes them from the card. They play from the card until the switch; cancel any time before it.',
] as const;
export const CARD_SONGS_PLAY = 'The card’s songs still play from it.';

const AWAY_COUNT: Readonly<
  Record<LibraryView, (volume: DataFolderVolume) => number>
> = {
  songs: ({ awaySongs }) => awaySongs,
  stems: ({ awayStemSongs }) => awayStemSongs,
};

const allSongs = (volume: DataFolderVolume) =>
  countLabel(volume.awaySongs + volume.awayStemSongs, ...SONG_NOUNS);

export function returnedStripDetail(
  volume: DataFolderVolume,
  view: LibraryView,
): string {
  const size = formatBytes(volume.awayBytes);
  const songs = viewCountLabel(AWAY_COUNT[view](volume), view);
  return songs === null ? size : `${songs} on it ${SEPARATOR} ${size}`;
}

export function returnedRowValue(volume: DataFolderVolume): RowValue {
  return {
    lead: allSongs(volume),
    detail: `${SEPARATOR} ${formatBytes(volume.awayBytes)}`,
    missing: false,
    highlighted: true,
  };
}

export function offerMovesValue(
  volume: DataFolderVolume,
): readonly [string, string] {
  return [formatBytes(volume.awayBytes), `${SEPARATOR} ${allSongs(volume)}`];
}

export function returnNoSpaceHints(
  card: DataFolderVolume,
  target: DataFolderVolume,
): readonly [string, string] {
  const short = Math.max(0, card.awayRequiredBytes - target.freeBytes);
  return [
    `The card’s songs need ${formatBytes(card.awayRequiredBytes)} and ${thePlace(target.volumeUuid)} has ${formatBytes(target.freeBytes)} free. Free up ${formatBytes(short)} to move them.`,
    'Nothing has moved. They are still on the card and play from it.',
  ];
}
