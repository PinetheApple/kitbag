import { freshClickSoundFileName } from '@kitbag/core-db';
import {
  clearClickSoundPartials,
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
  clearPartials: clearClickSoundPartials,
});

const clickSounds = clickSoundStore.getState();
void clickSounds
  .sync()
  .then(clickSounds.sweepOrphans)
  .catch((error: unknown) => {
    console.warn('[kitbag] click sounds did not load', error);
  });
