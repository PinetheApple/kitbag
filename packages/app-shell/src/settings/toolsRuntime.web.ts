import { configureToolsPersistence } from '@kitbag/core-state';

import { BUILT_TOOL_IDS } from '@/home/registry';
import {
  storedWebPreference,
  WEB_KEY_PREFIX,
} from '@/runtime/storedWebPreference';

import { toolsPersistence } from './toolsPreference.ts';

configureToolsPersistence(
  toolsPersistence(
    (key) => storedWebPreference(`${WEB_KEY_PREFIX}${key}`),
    BUILT_TOOL_IDS,
  ),
);
