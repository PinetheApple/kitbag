import type { Preferences } from '@kitbag/core-db';
import { KB_ACCENT, KB_RAMP_UNIT } from '@kitbag/core-native';
import type { StandaloneMetronome } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  STANDALONE_METRONOME_KEY,
  standaloneMetronomePreference,
} from './standaloneMetronomePreference.ts';

const SETTINGS: StandaloneMetronome = {
  bpm: 125,
  beatsPerBar: 7,
  denominator: 8,
  subdivision: 3,
  accents: [KB_ACCENT.KB_ACCENT_ACCENTED, KB_ACCENT.KB_ACCENT_MUTED],
  polyEnabled: true,
  polyBeats: 5,
  polyAgainst: 2,
  polyAccents: [KB_ACCENT.KB_ACCENT_NORMAL],
  sounds: { normal: 2, accent: 4 },
  ramp: {
    enabled: false,
    startBpm: 100,
    targetBpm: 140,
    stepBpm: 10,
    interval: 2,
    unit: KB_RAMP_UNIT.KB_RAMP_SECONDS,
    loop: true,
  },
  barMute: { enabled: true, playBars: 3, muteBars: 1 },
};

function memoryPreferences(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  const preferences: Preferences = {
    get: (key) => data.get(key),
    set: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
  return () => preferences;
}

describe('standalone metronome on the database', () => {
  it('survives a reload under one key', () => {
    const preferences = memoryPreferences();
    standaloneMetronomePreference(preferences).save(SETTINGS);
    expect(preferences().get(STANDALONE_METRONOME_KEY)).toBeDefined();
    expect(standaloneMetronomePreference(preferences).load()).toEqual(SETTINGS);
  });

  it('drops a field it does not recognise and keeps the rest', () => {
    const preferences = memoryPreferences({
      [STANDALONE_METRONOME_KEY]: JSON.stringify({
        ...SETTINGS,
        bpm: '125',
        accents: [KB_ACCENT.KB_ACCENT_ACCENTED, 'loud'],
        ramp: { ...SETTINGS.ramp, unit: 'hours' },
        sounds: { normal: 2 },
      }),
    });
    const dropped = new Set(['bpm', 'accents', 'ramp', 'sounds']);
    const valid = Object.fromEntries(
      Object.entries(SETTINGS).filter(([field]) => !dropped.has(field)),
    );
    expect(standaloneMetronomePreference(preferences).load()).toEqual(valid);
  });

  it('reads nothing from a value that is not JSON', () => {
    const preferences = memoryPreferences({
      [STANDALONE_METRONOME_KEY]: '{bpm: 125',
    });
    expect(standaloneMetronomePreference(preferences).load()).toEqual({});
  });
});
