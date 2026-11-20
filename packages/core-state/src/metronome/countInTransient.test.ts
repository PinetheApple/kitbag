import { expect, it, vi } from 'vitest';

import {
  applyCountInTransiently,
  configureCountInPersistence,
  reloadCountInPersistence,
  type CountInSettings,
} from './countInPersistence.ts';
import { stubMetronomeRuntime } from './runtime.test-helper.ts';
import { metronomeStore } from './store.ts';

const ENGINE_BPM = 120;
const USER: Partial<CountInSettings> = { bars: 1, distinct: false, sound: 0 };
const LOGGED = { bars: 2, distinct: true, sound: 3 } as const;

stubMetronomeRuntime(ENGINE_BPM);

let stored: Partial<CountInSettings> = USER;
const save = vi.fn((changed: Partial<CountInSettings>) => {
  stored = { ...stored, ...changed };
});
configureCountInPersistence({ load: () => stored, save });

it('never stores a count-in applied transiently, so a restart shows the user own', () => {
  applyCountInTransiently(() => {
    metronomeStore.getState().setCountIn(LOGGED);
  });
  expect(metronomeStore.getState().countIn).toEqual(LOGGED);
  expect(save).not.toHaveBeenCalled();

  reloadCountInPersistence();
  expect(metronomeStore.getState().countIn).toMatchObject(USER);
});

it('stores a count-in the user sets', () => {
  metronomeStore.getState().setCountIn(LOGGED);
  expect(save).toHaveBeenCalled();
  expect(stored).toMatchObject(LOGGED);
});
