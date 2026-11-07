import { configureSongPlayer } from '@kitbag/core-state';

import { getDatabase } from './database.ts';
import { mixerRuntime } from './stemPlayerRuntime';

configureSongPlayer({
  ...mixerRuntime,
  records: { readSong: (id) => getDatabase().songLibrary.readSong(id) },
});
