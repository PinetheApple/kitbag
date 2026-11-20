import type { QueuedSong } from '@kitbag/core-db';

import type { HeardSong } from './heard.ts';

export const NIGHT_BUS: QueuedSong = { kind: 'stems', id: 21 };
export const TIN_ROOF: QueuedSong = { kind: 'stems', id: 22 };
export const HUM: QueuedSong = { kind: 'song', id: 41 };

export const plain = (song: QueuedSong): HeardSong => ({
  song,
  setlistItemId: null,
});
