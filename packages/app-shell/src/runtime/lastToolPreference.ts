import type { Preferences } from '@kitbag/core-db';
import type { LastToolPersistence } from '@kitbag/core-state';

const KEY = 'last_tool';

// A database that fails to open costs Home its Continue card, not its render.
export function lastToolPreference(
  preferences: () => Preferences,
): LastToolPersistence {
  const warn = (error: unknown) => {
    console.warn('[kitbag] last-used tool not persisted', error);
  };
  return {
    load: () => {
      try {
        return preferences().get(KEY);
      } catch (error) {
        warn(error);
        return undefined;
      }
    },
    save: (toolId) => {
      try {
        preferences().set(KEY, toolId).catch(warn);
      } catch (error) {
        warn(error);
      }
    },
  };
}
