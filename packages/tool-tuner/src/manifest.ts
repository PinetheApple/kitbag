import type { CompiledToolManifest } from '@kitbag/core-plugin-api';

const ROUTES = {
  home: '/tuner',
} as const;

export const manifest = {
  id: 'tuner',
  name: 'Tuner',
  icon: 'tuner',
  routes: ROUTES,
} as const satisfies CompiledToolManifest;
