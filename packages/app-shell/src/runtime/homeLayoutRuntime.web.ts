import { configureHomeLayoutPersistence } from '@kitbag/core-state';

import { homeLayoutPersistence } from './homeLayoutPreference';
import { storedWebPreference } from './storedWebPreference';

configureHomeLayoutPersistence(
  homeLayoutPersistence(storedWebPreference('kitbag.homeLayout')),
);
