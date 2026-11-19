import { replaceKeepsText, type ReplaceMatch } from '@kitbag/core-state';

export const REPLACE_SHEET_TEXT = {
  dismiss: 'Don’t import',
  skip: 'Skip',
} as const;

export function replaceSheetTitle(titles: readonly string[]): string {
  const [first] = titles;
  return titles.length === 1 && first !== undefined
    ? `Replace “${first}”?`
    : `Replace ${String(titles.length)} songs?`;
}

function matchText(titles: readonly string[], match: ReplaceMatch): string {
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
  match: ReplaceMatch,
): string {
  return `${matchText(titles, match)} ${replaceKeepsText(match, titles.length)}`;
}
