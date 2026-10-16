import { configureLibrary } from '@kitbag/core-state';

import { getDatabase } from './database.ts';

configureLibrary({
  get setlists() {
    return getDatabase().setlists;
  },
  get presets() {
    return getDatabase().presets;
  },
});
