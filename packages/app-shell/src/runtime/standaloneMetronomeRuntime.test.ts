import { STANDALONE_METRONOME_KEY } from '@kitbag/core-db';
import { metronomeStore } from '@kitbag/core-state';
import type { AppStateStatus } from 'react-native';
import { expect, it, vi } from 'vitest';

const SWIPED_BPM = 133;

const appState = vi.hoisted(() => {
  const handlers: ((state: AppStateStatus) => void)[] = [];
  return {
    handlers,
    addEventListener: (
      _event: string,
      handler: (state: AppStateStatus) => void,
    ) => {
      handlers.push(handler);
    },
  };
});
const preferences = vi.hoisted(() => {
  const data = new Map<string, string>();
  return {
    data,
    get: (key: string) => data.get(key),
    set: (key: string, value: string) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
});

vi.mock('react-native', () => ({ AppState: appState }));
vi.mock('./database', () => ({ getDatabase: () => ({ preferences }) }));
vi.mock('@kitbag/core-native', async (actual) => ({
  ...(await actual<typeof import('@kitbag/core-native')>()),
  getKitbagCommands: () => new Proxy({}, { get: () => vi.fn() }),
}));

await import('./standaloneMetronomeRuntime.ts');

function moveApp(state: AppStateStatus) {
  appState.handlers.forEach((handler) => {
    handler(state);
  });
}

const storedBpm = () =>
  (
    JSON.parse(preferences.data.get(STANDALONE_METRONOME_KEY) ?? '{}') as {
      bpm?: number;
    }
  ).bpm;

it('writes the last tempo when the app goes to the background', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  metronomeStore.getState().setTempo(SWIPED_BPM);
  await Promise.resolve();
  moveApp('inactive');
  expect(storedBpm()).toBeUndefined();

  moveApp('background');

  expect(storedBpm()).toBe(SWIPED_BPM);
});
