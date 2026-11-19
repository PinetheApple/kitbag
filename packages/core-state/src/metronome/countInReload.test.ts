import { beforeEach, expect, it } from 'vitest';

import {
  configureCountInPersistence,
  reloadCountInPersistence,
  type CountInSettings,
} from './countInPersistence.ts';
import { COUNT_IN_SCOPE } from './countInScope.ts';
import { stubMetronomeRuntime } from './runtime.test-helper.ts';
import { initialConfig, metronomeStore } from './store.ts';

const ENGINE_BPM = 120;
const LIVE: Partial<CountInSettings> = {
  bars: 2,
  distinct: false,
  sound: 3,
  scope: COUNT_IN_SCOPE.always,
};
const RESTORED_BARS = 4;

stubMetronomeRuntime(ENGINE_BPM);

let stored: Partial<CountInSettings> = {};
configureCountInPersistence({
  load: () => stored,
  save: (changed) => {
    stored = { ...stored, ...changed };
  },
});

const defaults = initialConfig();
const liveCountIn = () => {
  const { countIn, countInScope } = metronomeStore.getState();
  return { ...countIn, scope: countInScope };
};

beforeEach(() => {
  stored = LIVE;
  reloadCountInPersistence();
});

it('applies count-in settings written underneath it, such as by a restore', () => {
  stored = { bars: RESTORED_BARS, scope: COUNT_IN_SCOPE.perSong };
  reloadCountInPersistence();

  expect(metronomeStore.getState().countIn.bars).toBe(RESTORED_BARS);
  expect(metronomeStore.getState().countInScope).toBe(COUNT_IN_SCOPE.perSong);
});

it('resets to the default count-in once the stored settings are gone', () => {
  stored = {};
  reloadCountInPersistence();

  expect(liveCountIn()).toEqual({
    ...defaults.countIn,
    scope: defaults.countInScope,
  });
  expect(stored).toEqual({});
});

it('resets only the keys the restore omitted', () => {
  stored = { bars: RESTORED_BARS };
  reloadCountInPersistence();

  expect(liveCountIn()).toEqual({
    ...defaults.countIn,
    bars: RESTORED_BARS,
    scope: defaults.countInScope,
  });
  expect(stored).toEqual({ bars: RESTORED_BARS });
});

it('keeps the current count-in when the stored settings are untouched', () => {
  reloadCountInPersistence();

  expect(liveCountIn()).toEqual(LIVE);
  expect(stored).toEqual(LIVE);
});
