import { configureSongPlayer } from '@kitbag/core-state';

import { mixerRuntime } from './mixerRuntime';

configureSongPlayer({
  ...mixerRuntime,
  records: { readSong: () => Promise.resolve(undefined) },
});
