import type { CompiledToolManifest } from '@kitbag/core-plugin-api';

const NAME = 'Stem songs';

const ROUTES = {
  home: '/stems',
  stemSet: '/stems/[id]',
  stemDeck: '/stemdeck',
  stemDeckCamera: '/stemdeck/camera',
  stemDeckImport: '/stemdeck/import',
  stemDeckSongs: '/stemdeck/songs',
} as const;

export const manifest = {
  id: 'stems',
  name: NAME,
  icon: 'stems',
  routes: ROUTES,
  homeTile: { label: NAME, route: ROUTES.home },
  summary: 'Mix and loop imported stems',
} as const satisfies CompiledToolManifest;
