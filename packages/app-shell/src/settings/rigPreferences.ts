import { KB_VOLUME_BOUNDS } from '@kitbag/core-native';
import type {
  SubdivisionAccentsPersistence,
  SubdivisionAccentsSettings,
} from '@kitbag/core-state';

import type { StoredPreference } from '@/runtime/storedPreference';

export const RIG_KEYS = {
  volume: 'rig_volume',
  accentMasks: 'rig_subdivision_accents',
  accentCount: 'rig_subdivision_accent_count',
} as const;

export type RigKey = (typeof RIG_KEYS)[keyof typeof RIG_KEYS];

export interface VolumePersistence {
  readonly load: () => number | undefined;
  readonly save: (volume: number) => void;
}

function readMasks(raw: string | undefined): number[] | undefined {
  if (raw === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((m) => typeof m === 'number')
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

function readInteger(raw: string | undefined): number | undefined {
  const value = Number(raw);
  return raw !== undefined && Number.isInteger(value) ? value : undefined;
}

export function accentsPersistence(
  stored: (key: RigKey) => StoredPreference,
): SubdivisionAccentsPersistence {
  return {
    load: () => {
      const masks = readMasks(stored(RIG_KEYS.accentMasks).read());
      const lastCount = readInteger(stored(RIG_KEYS.accentCount).read());
      const loaded: Partial<SubdivisionAccentsSettings> = {
        ...(masks === undefined ? {} : { masks }),
        ...(lastCount === undefined ? {} : { lastCount }),
      };
      return loaded;
    },
    save: ({ masks, lastCount }) => {
      if (masks !== undefined) {
        stored(RIG_KEYS.accentMasks).write(JSON.stringify(masks));
      }
      if (lastCount !== undefined) {
        stored(RIG_KEYS.accentCount).write(String(lastCount));
      }
    },
  };
}

export function volumePersistence(
  stored: (key: RigKey) => StoredPreference,
): VolumePersistence {
  return {
    load: () => {
      const raw = stored(RIG_KEYS.volume).read();
      const volume = Number(raw);
      return raw !== undefined &&
        Number.isFinite(volume) &&
        volume >= KB_VOLUME_BOUNDS.min &&
        volume <= KB_VOLUME_BOUNDS.max
        ? volume
        : undefined;
    },
    save: (volume) => {
      stored(RIG_KEYS.volume).write(String(volume));
    },
  };
}
