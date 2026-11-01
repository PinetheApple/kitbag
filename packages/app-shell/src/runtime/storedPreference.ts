import type { Preferences } from '@kitbag/core-db';

export const PREFERENCE_FLAG = { on: '1', off: '0' } as const;

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

export function readFlag(stored: StoredPreference): boolean | undefined {
  const value = stored.read();
  if (value === PREFERENCE_FLAG.on) return true;
  if (value === PREFERENCE_FLAG.off) return false;
  return undefined;
}

export function encodeFlag(on: boolean): string {
  return on ? PREFERENCE_FLAG.on : PREFERENCE_FLAG.off;
}

export function writeChanged<T extends object>(
  changed: Partial<T>,
  stored: (key: keyof T) => StoredPreference,
  encode: (value: T[keyof T]) => string,
): void {
  for (const key of Object.keys(changed) as (keyof T)[]) {
    const value = changed[key];
    if (value !== undefined) stored(key).write(encode(value));
  }
}
