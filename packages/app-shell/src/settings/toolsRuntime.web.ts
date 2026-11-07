import {
  configureToolsPersistence,
  getToolsStore,
  metronomeStore,
  songPlayerStore,
  stemPlayerStore,
} from '@kitbag/core-state';

import { BUILT_TOOL_IDS } from '@/home/registry';
import {
  storedWebPreference,
  WEB_KEY_PREFIX,
} from '@/runtime/storedWebPreference';

import { stopWhenSwitchedOff, toolStoppers } from './toolStoppers.ts';
import { toolsPersistence } from './toolsPreference.ts';

configureToolsPersistence(
  toolsPersistence(
    (key) => storedWebPreference(`${WEB_KEY_PREFIX}${key}`),
    BUILT_TOOL_IDS,
  ),
);

stopWhenSwitchedOff(
  getToolsStore(),
  toolStoppers({
    metronome: {
      active: () => metronomeStore.getState().running,
      release: () => {
        metronomeStore.getState().stop();
      },
    },
    stemPlayer: stemPlayerStore,
    songPlayer: songPlayerStore,
  }),
);
