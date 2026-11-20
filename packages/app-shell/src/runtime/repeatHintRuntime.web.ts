import { configureRepeatAllHintPersistence } from '@kitbag/core-state';

import { storedWebPreference } from './storedWebPreference';

const SEEN = '1';
const stored = storedWebPreference('kitbag.repeatAllHintSeen');

configureRepeatAllHintPersistence({
  load: () => stored.read() === SEEN,
  save: () => {
    stored.write(SEEN);
  },
});
