import { countLabel } from '@kitbag/core-design';
import type { LibraryView } from '@kitbag/core-state';

export const SONG_NOUNS = ['song', 'songs'] as const;
export const STEM_SONG_NOUNS = ['stem song', 'stem songs'] as const;

const VIEW_NOUNS: Readonly<Record<LibraryView, readonly [string, string]>> = {
  songs: SONG_NOUNS,
  stems: STEM_SONG_NOUNS,
};

export function viewCount(count: number, view: LibraryView): string | null {
  if (count === 0) return null;
  const [one, many] = VIEW_NOUNS[view];
  return countLabel(count, one, many);
}
