import type { CompiledToolManifest } from '@kitbag/core-plugin-api';

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
  name: 'Stem songs',
  icon: 'stems',
  routes: ROUTES,
  summary: 'Mix and loop imported stems',
} as const satisfies CompiledToolManifest;
