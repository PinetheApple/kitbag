import type { CompiledToolManifest } from '@kitbag/core-plugin-api';

const NAME = 'Tuner';

const ROUTES = {
  home: '/tuner',
} as const;

export const manifest = {
  id: 'tuner',
  name: NAME,
  icon: 'tuner',
  routes: ROUTES,
  homeTile: { label: NAME, route: ROUTES.home },
} as const satisfies CompiledToolManifest;
