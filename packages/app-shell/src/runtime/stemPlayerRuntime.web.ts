import { KB_COUNT_IN_OFF } from '@kitbag/core-native';
import { configureStemPlayer } from '@kitbag/core-state';

import { mixdownRuntime } from './mixdownRuntime.ts';
import { mixerRuntime } from './mixerRuntime';

configureStemPlayer({
  ...mixerRuntime,
  countInBars: () => KB_COUNT_IN_OFF,
  mixdown: mixdownRuntime,
  records: {
    readStemSet: () => Promise.resolve(undefined),
    saveStemMix: () => Promise.resolve(),
    renameStem: () => Promise.resolve(),
    saveLyricsRetimed: () => Promise.resolve(),
    saveStemSetMeterOverride: () => Promise.resolve(),
    saveStemSetClick: () => Promise.resolve(),
    saveStemSetChosenTempoMode: () => Promise.resolve(),
  },
});
