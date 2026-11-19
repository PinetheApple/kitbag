import { expect, it } from 'vitest';

import {
  configureCountInPersistence,
  reloadCountInPersistence,
  type CountInSettings,
} from './countInPersistence.ts';
import { COUNT_IN_SCOPE } from './countInScope.ts';
import { stubMetronomeRuntime } from './runtime.test-helper.ts';
import { metronomeStore } from './store.ts';

const ENGINE_BPM = 120;

stubMetronomeRuntime(ENGINE_BPM);

it('applies count-in settings written underneath it, such as by a restore', () => {
  let stored: Partial<CountInSettings> = { bars: 1 };
  configureCountInPersistence({
    load: () => stored,
    save: (changed) => {
      stored = { ...stored, ...changed };
    },
  });
  expect(metronomeStore.getState().countIn.bars).toBe(1);

  stored = { bars: 4, scope: COUNT_IN_SCOPE.always };
  reloadCountInPersistence();

  expect(metronomeStore.getState().countIn.bars).toBe(4);
  expect(metronomeStore.getState().countInScope).toBe(COUNT_IN_SCOPE.always);
});
