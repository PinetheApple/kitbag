import type { SeenFlagPersistence } from '@kitbag/core-state';

import { encodeFlag, readFlag } from './storedPreference';
import { storedWebPreference, WEB_KEY_PREFIX } from './storedWebPreference';

const stored = storedWebPreference(
  `${WEB_KEY_PREFIX}listenerExplainerDeclined`,
);

export const listenerExplainerFlag: SeenFlagPersistence = {
  load: () => readFlag(stored) === true,
  save: () => {
    stored.write(encodeFlag(true));
  },
};
