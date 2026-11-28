import type { CompiledToolManifest } from '@kitbag/core-plugin-api';

const NAME = 'Play along';

const ROUTES = {
  home: '/sync',
} as const;

export const manifest = {
  id: 'sync',
  name: NAME,
  icon: 'playAlong',
  routes: ROUTES,
  homeTile: { label: NAME, route: ROUTES.home },
  summary: 'Needs notification access',
} as const satisfies CompiledToolManifest;
