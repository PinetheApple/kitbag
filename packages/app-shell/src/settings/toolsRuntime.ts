import {
  configureToolsPersistence,
  getToolsStore,
  songPlayerStore,
  stemPlayerStore,
} from '@kitbag/core-state';

import { BUILT_TOOL_IDS } from '@/home/registry';
import { getDatabase } from '@/runtime/database';
import { storedPreference } from '@/runtime/storedPreference';
import { metronomeTransport } from '@/runtime/transportRuntime';

import { stopWhenSwitchedOff, toolStoppers } from './toolStoppers.ts';
import { toolsPersistence } from './toolsPreference.ts';

configureToolsPersistence(
  toolsPersistence(
    (key) =>
      storedPreference(() => getDatabase().preferences, key, 'tool switch'),
    BUILT_TOOL_IDS,
  ),
);

stopWhenSwitchedOff(
  getToolsStore(),
  toolStoppers({
    metronome: metronomeTransport,
    stemPlayer: stemPlayerStore,
    songPlayer: songPlayerStore,
  }),
);
