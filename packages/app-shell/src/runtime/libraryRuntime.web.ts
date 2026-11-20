import { configureLibrary, configurePlayOrder } from '@kitbag/core-state';

import { createMemoryLibrary } from './memoryLibrary.ts';
import { createMemoryPlayQueue } from './memoryPlayQueue.ts';

configureLibrary(createMemoryLibrary(globalThis.localStorage));
configurePlayOrder({ queue: createMemoryPlayQueue() });
