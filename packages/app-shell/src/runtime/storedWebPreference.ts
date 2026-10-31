import type { StoredPreference } from './storedPreference';

export const WEB_KEY_PREFIX = 'kitbag.';

// localStorage throws when storage is disabled; an unpersisted value is still
// correct for the session, so the screen renders without it.
export function storedWebPreference(key: string): StoredPreference {
  return {
    read: () => {
      try {
        return globalThis.localStorage.getItem(key) ?? undefined;
      } catch {
        return undefined;
      }
    },
    write: (value) => {
      try {
        globalThis.localStorage.setItem(key, value);
      } catch {
        return;
      }
    },
  };
}
