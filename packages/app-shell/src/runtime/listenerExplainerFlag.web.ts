import { seenFlag } from './seenFlagPreference';
import { storedWebPreference, WEB_KEY_PREFIX } from './storedWebPreference';

export const listenerExplainerFlag = seenFlag(
  storedWebPreference(`${WEB_KEY_PREFIX}listenerExplainerDeclined`),
);
