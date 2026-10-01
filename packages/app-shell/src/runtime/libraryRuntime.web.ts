import { configureLibrary } from '@kitbag/core-state';

import { createMemoryLibrary } from './memoryLibrary.ts';

configureLibrary(createMemoryLibrary(globalThis.localStorage));
