import { freshClickSoundFileName } from '@kitbag/core-db';
import {
  clearCustomSound,
  deleteClickSound,
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
});

void clickSoundStore.getState().sync();
