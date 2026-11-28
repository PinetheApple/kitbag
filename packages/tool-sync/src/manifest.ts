import type { CompiledToolManifest } from '@kitbag/core-plugin-api';

const ROUTES = {
  home: '/sync',
} as const;

export const manifest = {
  id: 'sync',
  name: 'Play along',
  icon: 'playAlong',
  routes: ROUTES,
  summary: 'Needs notification access',
} as const satisfies CompiledToolManifest;
