import { configureStemPlayer } from '@kitbag/core-state';

import { mixerRuntime } from './mixerRuntime';

configureStemPlayer({
  ...mixerRuntime,
  records: {
    readStemSet: () => Promise.resolve(undefined),
    saveStemMix: () => Promise.resolve(),
    renameStem: () => Promise.resolve(),
    saveLyricsRetimed: () => Promise.resolve(),
  },
});
