import type { CompiledToolManifest } from '@kitbag/core-plugin-api';

const ROUTES = {
  home: '/library',
  song: '/library/[id]',
} as const;

export const manifest = {
  id: 'library',
  name: 'Songs',
  icon: 'songs',
  routes: ROUTES,
  summary: 'Imported songs, beats analyzed',
} as const satisfies CompiledToolManifest;
