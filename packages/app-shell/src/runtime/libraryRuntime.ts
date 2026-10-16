import { configureLibrary } from '@kitbag/core-state';

import { getDatabase } from './database.ts';

configureLibrary(getDatabase());
