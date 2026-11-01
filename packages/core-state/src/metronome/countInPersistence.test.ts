import { KB_DEFAULT_COUNT_IN_SOUND } from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

import type { MetronomeCommands } from './commands.ts';
import {
  bindCountInPersistence,
  type CountInPersistence,
  type CountInSettings,
} from './countInPersistence.ts';
import { COUNT_IN_SCOPE, DEFAULT_COUNT_IN_SCOPE } from './countInScope.ts';
import { createMetronomeStore } from './store.ts';

const STORED_SOUND = 4;

function memoryPersistence(initial: Partial<CountInSettings> = {}) {
  let stored: Partial<CountInSettings> = initial;
  const saves: Partial<CountInSettings>[] = [];
  const persistence: CountInPersistence = {
    load: () => stored,
    save: (changed) => {
      saves.push(changed);
      stored = { ...stored, ...changed };
    },
  };
  return { persistence, saves };
}

function launch(persistence: CountInPersistence) {
  const setCountIn = vi.fn();
  const fakes: Record<string, unknown> = { setCountIn };
  const commands = new Proxy(fakes, {
    get: (target, key: string) => (target[key] ??= vi.fn()),
  }) as unknown as MetronomeCommands;
  const store = createMetronomeStore(
    commands,
    () => 0,
    () => 120,
  );
  bindCountInPersistence(store, persistence);
  return { store, setCountIn };
}

describe('count-in settings across an app restart', () => {
  it('start per song with the engine default count-in when nothing is stored', () => {
    const { store, setCountIn } = launch(memoryPersistence().persistence);
    expect(store.getState().countInScope).toBe(DEFAULT_COUNT_IN_SCOPE);
    expect(store.getState().countIn).toEqual({
      bars: 0,
      distinct: true,
      sound: KB_DEFAULT_COUNT_IN_SOUND,
    });
    expect(setCountIn).not.toHaveBeenCalled();
  });

  it('survive a restart and reach the engine', () => {
    const { persistence } = memoryPersistence();
    const first = launch(persistence).store.getState();
    first.setCountInScope(COUNT_IN_SCOPE.always);
    first.setCountIn({ bars: 2, distinct: false, sound: STORED_SOUND });

    const { store, setCountIn } = launch(persistence);
    expect(store.getState().countInScope).toBe(COUNT_IN_SCOPE.always);
    expect(store.getState().countIn).toEqual({
      bars: 2,
      distinct: false,
      sound: STORED_SOUND,
    });
    expect(setCountIn).toHaveBeenLastCalledWith(2, false, STORED_SOUND);
  });

  it('keep the last live count-in while per song, for a switch to always', () => {
    const { persistence } = memoryPersistence();
    launch(persistence)
      .store.getState()
      .setCountIn({ bars: 4, distinct: true, sound: STORED_SOUND });
    const { store } = launch(persistence);
    expect(store.getState().countInScope).toBe(COUNT_IN_SCOPE.perSong);
    expect(store.getState().countIn.bars).toBe(4);
  });

  it('write only what changed', () => {
    const { persistence, saves } = memoryPersistence();
    const { store } = launch(persistence);
    store.getState().setTempo(130);
    store.getState().setCountIn({ ...store.getState().countIn, bars: 1 });
    expect(saves).toEqual([{ bars: 1 }]);
  });
});
