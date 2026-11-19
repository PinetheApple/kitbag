import type { StemDeckReplaceMatch } from '@kitbag/core-state';

export const REPLACE_SHEET_TEXT = {
  dismiss: 'Don’t import',
  keepCurrent: 'Keep current',
  cancel: 'Cancel',
  keepBoth: 'Keep both',
  replace: 'Replace',
} as const;

const KEEPS_ONE =
  'Replacing it removes that song’s stems and analysis and adds this copy; your names for the song and its stems are kept, and so are its speed, meter and mix. This cannot be undone.';
const KEEPS_MANY =
  'Replacing them removes their stems and analysis and adds these copies; your names for the songs and their stems are kept, and so are their speed, meter and mix. This cannot be undone.';

export function replaceSheetTitle(titles: readonly string[]): string {
  const [first] = titles;
  return titles.length === 1 && first !== undefined
    ? `Replace “${first}”?`
    : `Replace ${String(titles.length)} songs?`;
}

function matchText(
  titles: readonly string[],
  match: StemDeckReplaceMatch,
): string {
  const [first] = titles;
  const one = titles.length === 1 && first !== undefined;
  const named = one ? `“${first}”` : titles.join(', ');
  if (match === 'job')
    return one
      ? `${named} is already in your library.`
      : `${named} are already in your library.`;
  return one
    ? `${named} looks like a song in your library, separated again in StemDeck. Keep both to add it as a second song.`
    : `${named} look like songs in your library, separated again in StemDeck. Keep both to add them as second songs.`;
}

export function replaceHint(
  titles: readonly string[],
  match: StemDeckReplaceMatch,
): string {
  return `${matchText(titles, match)} ${titles.length === 1 ? KEEPS_ONE : KEEPS_MANY}`;
}
