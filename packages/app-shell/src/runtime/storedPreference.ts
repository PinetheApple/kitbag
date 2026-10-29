import type { Preferences } from '@kitbag/core-db';

export interface StoredPreference {
  readonly read: () => string | undefined;
  readonly write: (value: string) => void;
}

// A database that fails to open costs the stored value, not the render.
export function storedPreference(
  preferences: () => Preferences,
  key: string,
  what: string,
): StoredPreference {
  const warn = (error: unknown) => {
    console.warn(`[kitbag] ${what} not persisted`, error);
  };
  return {
    read: () => {
      try {
        return preferences().get(key);
      } catch (error) {
        warn(error);
        return undefined;
      }
    },
    write: (value) => {
      try {
        preferences().set(key, value).catch(warn);
      } catch (error) {
        warn(error);
      }
    },
  };
}
