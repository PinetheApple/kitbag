import { expect, it } from 'vitest';

import { stubMetronomeRuntime } from './runtime.test-helper.ts';
import {
  standaloneMetronomeOf,
  type MetronomeSettingsInput,
} from './standalone.ts';
import {
  configureStandaloneMetronomePersistence,
  reloadStandaloneMetronomePersistence,
} from './standalonePersistence.ts';
import { initialConfig, metronomeStore } from './store.ts';

const STORED_BPM = 110;
const RESTORED_BPM = 140;
const RESTORED_BEATS = 7;

stubMetronomeRuntime(STORED_BPM);

let stored: Partial<MetronomeSettingsInput> = { bpm: STORED_BPM };
configureStandaloneMetronomePersistence({
  load: () => stored,
  save: (settings) => {
    stored = settings;
  },
});

it('applies standalone settings written underneath it, such as by a restore', () => {
  expect(metronomeStore.getState().bpm).toBe(STORED_BPM);

  stored = { bpm: RESTORED_BPM, beatsPerBar: RESTORED_BEATS };
  reloadStandaloneMetronomePersistence();

  expect(metronomeStore.getState().bpm).toBe(RESTORED_BPM);
  expect(metronomeStore.getState().beatsPerBar).toBe(RESTORED_BEATS);
});

it('resets to the default settings once the stored ones are gone', () => {
  stored = { bpm: RESTORED_BPM, beatsPerBar: RESTORED_BEATS };
  reloadStandaloneMetronomePersistence();

  stored = {};
  reloadStandaloneMetronomePersistence();

  expect(standaloneMetronomeOf(metronomeStore.getState())).toEqual(
    standaloneMetronomeOf(initialConfig()),
  );
});
