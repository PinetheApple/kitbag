import type { Preferences } from '@kitbag/core-db';
import { KB_ACCENT, KB_RAMP_UNIT } from '@kitbag/core-native';
import type {
  MetronomeSettingsInput,
  StandaloneMetronomePersistence,
} from '@kitbag/core-state';

import { storedPreference, type StoredPreference } from './storedPreference';

export const STANDALONE_METRONOME_KEY = 'metronome_standalone';

type Check = (value: unknown) => boolean;

const ACCENTS = new Set<unknown>(Object.values(KB_ACCENT));
const RAMP_UNITS = new Set<unknown>(Object.values(KB_RAMP_UNIT));

const isNumber: Check = (value) =>
  typeof value === 'number' && Number.isFinite(value);
const isFlag: Check = (value) => typeof value === 'boolean';
const isAccents: Check = (value) =>
  Array.isArray(value) && value.every((accent) => ACCENTS.has(accent));

function isShaped(shape: Readonly<Record<string, Check>>): Check {
  return (value) =>
    typeof value === 'object' &&
    value !== null &&
    Object.entries(shape).every(([key, check]) =>
      check((value as Record<string, unknown>)[key]),
    );
}

const FIELD_CHECKS: Readonly<Record<keyof MetronomeSettingsInput, Check>> = {
  bpm: isNumber,
  beatsPerBar: isNumber,
  denominator: isNumber,
  subdivision: isNumber,
  accents: isAccents,
  polyEnabled: isFlag,
  polyBeats: isNumber,
  polyAgainst: isNumber,
  polyAccents: isAccents,
  sounds: isShaped({ normal: isNumber, accent: isNumber }),
  ramp: isShaped({
    enabled: isFlag,
    startBpm: isNumber,
    targetBpm: isNumber,
    stepBpm: isNumber,
    interval: isNumber,
    unit: (unit) => RAMP_UNITS.has(unit),
    loop: isFlag,
  }),
  barMute: isShaped({
    enabled: isFlag,
    playBars: isNumber,
    muteBars: isNumber,
  }),
};

function decodeStandaloneMetronome(
  text: string | undefined,
): Partial<MetronomeSettingsInput> {
  if (text === undefined) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null) return {};
  const record = parsed as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(FIELD_CHECKS)
      .filter(([field, check]) => check(record[field]))
      .map(([field]) => [field, record[field]]),
  );
}

export function standaloneMetronomePersistence(
  stored: StoredPreference,
): StandaloneMetronomePersistence {
  return {
    load: () => decodeStandaloneMetronome(stored.read()),
    save: (settings) => {
      stored.write(JSON.stringify(settings));
    },
  };
}

export function standaloneMetronomePreference(
  preferences: () => Preferences,
): StandaloneMetronomePersistence {
  return standaloneMetronomePersistence(
    storedPreference(
      preferences,
      STANDALONE_METRONOME_KEY,
      'metronome setting',
    ),
  );
}
