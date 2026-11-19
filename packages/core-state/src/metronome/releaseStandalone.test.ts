import { customSoundId, KB_DEFAULT_SOUNDS } from '@kitbag/core-native';
import { expect, it } from 'vitest';

import { libraryStore } from '../library/store.ts';
import { stubMetronomeRuntime } from './runtime.test-helper.ts';
import type { MetronomeSettingsInput } from './standalone.ts';
import {
  configureStandaloneMetronomePersistence,
  releaseStandaloneSound,
} from './standalonePersistence.ts';

const STORED_BPM = 110;
const BUILT_IN = 2;
const REMOVED = customSoundId(0);
const LOADED_SONG = { presetId: 7, itemId: null, setlistId: null };

stubMetronomeRuntime(STORED_BPM);

let stored: Partial<MetronomeSettingsInput> = {
  bpm: STORED_BPM,
  sounds: { normal: BUILT_IN, accent: REMOVED },
};
configureStandaloneMetronomePersistence({
  load: () => stored,
  save: (settings) => {
    stored = settings;
  },
});

it('puts Tick in the stored standalone sounds at once while a song is loaded', () => {
  libraryStore.setState({ loaded: LOADED_SONG });

  releaseStandaloneSound(REMOVED);

  expect(stored.sounds).toEqual({
    normal: BUILT_IN,
    accent: KB_DEFAULT_SOUNDS.accent,
  });
  expect(stored.bpm).toBe(STORED_BPM);
});

it('leaves stored sounds that never used it', () => {
  const before = { normal: BUILT_IN, accent: BUILT_IN };
  stored = { bpm: STORED_BPM, sounds: before };

  releaseStandaloneSound(REMOVED);

  expect(stored.sounds).toBe(before);
});
