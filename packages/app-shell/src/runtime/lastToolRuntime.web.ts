import { configureLastToolPersistence } from '@kitbag/core-state';

import { storedWebPreference } from './storedWebPreference';

const stored = storedWebPreference('kitbag.lastTool');

configureLastToolPersistence({ load: stored.read, save: stored.write });
