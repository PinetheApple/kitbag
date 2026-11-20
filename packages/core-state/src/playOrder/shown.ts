import type { SongPlayerStore } from '../songPlayer/store.ts';
import type { StemPlayerStore } from '../stemPlayer/store.ts';

export const songShown = (s: SongPlayerStore) => s.status === 'ready';

export const stemShown = (s: StemPlayerStore) =>
  s.status === 'ready' || (s.status === 'loading' && s.advancedTo !== null);
