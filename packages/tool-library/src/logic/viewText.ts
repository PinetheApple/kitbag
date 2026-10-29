import type { EmptyStateOption, IconName } from '@kitbag/core-design';
import type { LibraryView } from '@kitbag/core-state';

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
    emptyReason: 'Import a StemDeck song folder to mix and loop its stems.',
    emptyAction: 'Import stems folder',
    emptyOption: { icon: 'folder', text: 'Pick a stems folder → a stem song' },
    fabIcon: 'folder',
    fabLabel: 'Import a stem song folder',
  },
};
