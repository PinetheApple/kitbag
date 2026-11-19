import type { ReplaceMatch } from './store.ts';

export const REPLACE_LABELS = {
  keepCurrent: 'Keep current',
  keepBoth: 'Keep both',
  replace: 'Replace',
} as const;

const KEEPS = {
  one: {
    removes:
      'Replacing it removes that song’s stems and analysis and adds this copy.',
    kept: 'Your names for the song and its stems are kept, and so are its speed, meter, and its mix and key unless this copy brings its own.',
  },
  many: {
    removes:
      'Replacing them removes their stems and analysis and adds these copies.',
    kept: 'Your names for the songs and their stems are kept, and so are their speed, meter, and their mix and key unless these copies bring their own.',
  },
} as const;

const TIMES: Readonly<Record<ReplaceMatch, string>> = {
  job: 'Bar one is kept, and so is your lyric timing while the lyrics are unchanged.',
  song: 'Bar one and your lyric timing start over, since this is new audio.',
};

const CANNOT_UNDO = 'This cannot be undone.';

export function replaceKeepsText(match: ReplaceMatch, count: number): string {
  const { removes, kept } = count === 1 ? KEEPS.one : KEEPS.many;
  return [removes, kept, TIMES[match], CANNOT_UNDO].join(' ');
}
