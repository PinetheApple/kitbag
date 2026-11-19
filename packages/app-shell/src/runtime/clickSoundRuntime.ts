import { freshClickSoundFileName } from '@kitbag/core-db';
import {
  clearCustomSound,
  deleteClickSound,
  getKitbagLibrary,
  listClickSounds,
  loadCustomSound,
  prepareClickSound,
} from '@kitbag/core-native';
import {
  clickSoundStore,
  configureClickSounds,
  releaseRemovedSound,
  restoreStore,
} from '@kitbag/core-state';

import { getDatabase } from './database.ts';

configureClickSounds({
  repository: () => getDatabase().clickSounds,
  prepare: prepareClickSound,
  load: loadCustomSound,
  clear: clearCustomSound,
  deleteFile: deleteClickSound,
  newUuid: () => crypto.randomUUID(),
  freshFileName: freshClickSoundFileName,
  afterRemove: releaseRemovedSound,
  pickDocument: () => getKitbagLibrary().pickDocument(),
  constants: () => getKitbagLibrary().getConstants(),
  listFiles: listClickSounds,
  restoring: () => restoreStore.getState().restore.phase === 'applying',
});

const sounds = clickSoundStore.getState();
void sounds.sync().then(sounds.sweepOrphans);
