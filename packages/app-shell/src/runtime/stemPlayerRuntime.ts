import { configureStemPlayer } from '@kitbag/core-state';

import { getDatabase } from './database.ts';
import { mixerRuntime } from './mixerRuntime';

configureStemPlayer({
  ...mixerRuntime,
  records: {
    readStemSet: (id) => getDatabase().songLibrary.readStemSet(id),
    saveStemMix: (mixes) => getDatabase().songLibrary.saveStemMix(mixes),
    renameStem: (id, name) => getDatabase().songLibrary.renameStem(id, name),
  },
});
