import { expect, it, vi } from 'vitest';

import type { MetronomeCommands } from './commands.ts';
import {
  configureCountInPersistence,
  reloadCountInPersistence,
  type CountInSettings,
} from './countInPersistence.ts';
import { COUNT_IN_SCOPE } from './countInScope.ts';
import { configureMetronomeRuntime } from './runtime.ts';
import { metronomeStore } from './store.ts';

const commands = new Proxy(
  {},
  {
    get: (target: Record<string, unknown>, key: string) =>
      (target[key] ??= vi.fn()),
  },
) as unknown as MetronomeCommands;

configureMetronomeRuntime({
  commands,
  nowFrame: () => 0,
  engineBpm: () => 120,
});

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
