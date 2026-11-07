import { configureSongPlayer } from '@kitbag/core-state';

import { mixerRuntime } from './stemPlayerRuntime';

configureSongPlayer({
  ...mixerRuntime,
  records: { readSong: () => Promise.resolve(undefined) },
});
