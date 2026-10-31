import type { Preferences } from '@kitbag/core-db';
import type {
  HomeLayoutPersistence,
  SavedArrangement,
} from '@kitbag/core-state';

import { storedPreference, type StoredPreference } from './storedPreference';

export const HOME_LAYOUT_KEY = 'home_layout';

type SavedTile = SavedArrangement[number];

function isSavedTile(value: unknown): value is SavedTile {
  if (typeof value !== 'object' || value === null) return false;
  const tile = value as Record<string, unknown>;
  return (
    typeof tile.toolId === 'string' &&
    typeof tile.size === 'string' &&
    typeof tile.hidden === 'boolean'
  );
}

export function encodeArrangement(arrangement: SavedArrangement): string {
  return JSON.stringify(
    arrangement.map(({ toolId, size, hidden }) => ({ toolId, size, hidden })),
  );
}

export function decodeArrangement(
  text: string | undefined,
): SavedArrangement | undefined {
  if (text === undefined) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed)) return undefined;
  return parsed.filter(isSavedTile);
}

export function homeLayoutPersistence(
  stored: StoredPreference,
): HomeLayoutPersistence {
  return {
    load: () => decodeArrangement(stored.read()),
    save: (arrangement) => {
      stored.write(encodeArrangement(arrangement));
    },
  };
}

export function homeLayoutPreference(
  preferences: () => Preferences,
): HomeLayoutPersistence {
  return homeLayoutPersistence(
    storedPreference(preferences, HOME_LAYOUT_KEY, 'home layout'),
  );
}
