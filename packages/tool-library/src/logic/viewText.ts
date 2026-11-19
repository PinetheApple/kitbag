import type { EmptyStateOption, IconName } from '@kitbag/core-design';
import type { LibraryView } from '@kitbag/core-state';

export const REANALYZE_LABEL = 'Re-analyse';
export const BACK_TO_SONGS = 'Back to songs';
export const LOOP_KEY_TEXT = 'A|B';
export const SPEED_KEY_TEXT = '1.0×';
export const SPEED_KEY_LABEL = `Speed ${SPEED_KEY_TEXT}, not built yet`;
export const SPEED_NOTE =
  "Speed isn't built yet. It arrives with the stem player's.";

export const REPLACE_SHEET_TEXT = {
  dismiss: 'Keep the current song',
  cancel: 'Cancel',
} as const;

export const replaceSheetTitle = (title: string) => `Replace “${title}”?`;
export const replaceButtonLabel = (title: string) => `Replace ${title}`;

export interface ViewText {
  readonly title: string;
  readonly search: string;
  readonly searchLabel: string;
  readonly noMatch: string;
  readonly emptyTitle: string;
  readonly emptyReason: string;
  readonly emptyAction: string;
  readonly emptyOption: EmptyStateOption | null;
  readonly fabIcon: IconName;
  readonly fabLabel: string;
}

export const VIEW_TEXT: Readonly<Record<LibraryView, ViewText>> = {
  songs: {
    title: 'Songs',
    search: 'Search songs',
    searchLabel: 'Search songs and artists',
    noMatch: 'No songs match this search.',
    emptyTitle: 'Add your first song',
    emptyReason:
      'Import an audio file. Its beats are found in the background, so the metronome can lock to it.',
    emptyAction: 'Import',
    emptyOption: null,
    fabIcon: 'add',
    fabLabel: 'Import a song',
  },
  stems: {
    title: 'Stem songs',
    search: 'Search stem songs',
    searchLabel: 'Search stem songs',
    noMatch: 'No stem songs match this search.',
    emptyTitle: 'No stem songs yet',
    emptyReason:
      'Add a StemDeck song from this phone or from StemDeck on Wi-Fi, then mix and loop its stems.',
    emptyAction: 'Add a stem song',
    emptyOption: {
      icon: 'stemDeckServer',
      text: 'A .zip, a folder or StemDeck on Wi-Fi → a stem song',
    },
    fabIcon: 'add',
    fabLabel: 'Add a stem song',
  },
};
