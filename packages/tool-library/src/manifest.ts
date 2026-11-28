import type { CompiledToolManifest } from '@kitbag/core-plugin-api';

const NAME = 'Songs';

const ROUTES = {
  home: '/library',
  song: '/library/[id]',
} as const;

export const manifest = {
  id: 'library',
  name: NAME,
  icon: 'songs',
  routes: ROUTES,
  homeTile: { label: NAME, route: ROUTES.home },
  summary: 'Imported songs, beats analyzed',
} as const satisfies CompiledToolManifest;
