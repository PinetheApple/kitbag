import { KB_COUNT_IN_OFF } from '@kitbag/core-native';
import {
  configureStemPlayer,
  metronomeStore,
  songCountIn,
} from '@kitbag/core-state';

import { getDatabase } from './database.ts';
import { mixerRuntime } from './mixerRuntime';

const STEM_SET_COUNT_IN_BARS = KB_COUNT_IN_OFF;

configureStemPlayer({
  ...mixerRuntime,
  countInBars: () => {
    const { countInScope, countIn } = metronomeStore.getState();
    return songCountIn(countInScope, STEM_SET_COUNT_IN_BARS, countIn).bars;
  },
  records: {
    readStemSet: (id) => getDatabase().songLibrary.readStemSet(id),
    saveStemMix: (mixes) => getDatabase().songLibrary.saveStemMix(mixes),
    renameStem: (id, name) => getDatabase().songLibrary.renameStem(id, name),
    saveLyricsRetimed: (id, times) =>
      getDatabase().songLibrary.saveLyricsRetimed(id, times),
  },
});
