import { getDatabase } from './database';
import { listenerExplainerPreference } from './listenerExplainerPreference';

export const listenerExplainerFlag = listenerExplainerPreference(
  () => getDatabase().preferences,
);
