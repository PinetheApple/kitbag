import { TOOL_MANIFESTS } from '../toolManifests.ts';

const { library, stems, sync, tuner } = TOOL_MANIFESTS;

export const TOOL_ID = {
  metronome: 'metronome',
  tuner: tuner.id,
  library: library.id,
  stems: stems.id,
  sync: sync.id,
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
  [TOOL_ID.tuner]: tuner.routes,
  [TOOL_ID.library]: library.routes,
  [TOOL_ID.stems]: stems.routes,
  [TOOL_ID.sync]: sync.routes,
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
