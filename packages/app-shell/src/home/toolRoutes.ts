export const TOOL_ID = {
  metronome: 'metronome',
  tuner: 'tuner',
  library: 'library',
  stems: 'stems',
  sync: 'sync',
  practiceHistory: 'practiceHistory',
} as const;

export const TOOL_ROUTES = {
  [TOOL_ID.metronome]: {
    home: '/metronome',
    allSongs: '/songs',
    preset: '/presets/[id]',
    setlists: '/setlists',
    setlist: '/setlists/[id]',
  },
  [TOOL_ID.tuner]: { home: '/tuner' },
  [TOOL_ID.library]: { home: '/library', song: '/library/[id]' },
  [TOOL_ID.stems]: {
    home: '/stems',
    stemSet: '/stems/[id]',
    stemDeck: '/stemdeck',
    stemDeckCamera: '/stemdeck/camera',
    stemDeckImport: '/stemdeck/import',
    stemDeckSongs: '/stemdeck/songs',
  },
  [TOOL_ID.sync]: { home: '/sync' },
  [TOOL_ID.practiceHistory]: {
    home: '/practice',
    session: '/practice/[uuid]',
  },
} as const;

const ID_SEGMENT = '[id]';

type FilledRoute<R> = R extends `${infer Base}/[id]`
  ? `${Base}/${string}`
  : never;

export function withId<R extends `${string}/[id]`>(
  route: R,
  id: number,
): FilledRoute<R> {
  return route.replace(ID_SEGMENT, String(id)) as FilledRoute<R>;
}
