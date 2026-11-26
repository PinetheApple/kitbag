import { beforeEach, expect, it, vi } from 'vitest';

interface State {
  readonly lock: object | undefined;
}
type Listener = (state: State) => void;

const store = vi.hoisted(() => {
  const state: { lock: object | undefined } = { lock: undefined };
  return {
    state,
    listeners: new Set<(state: { lock: object | undefined }) => void>(),
  };
});

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  getPlayAlongStore: () => ({
    getState: () => store.state,
    subscribe: (listener: Listener) => {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
  }),
}));

const { msToNextSecond, releaseWhenUnlocked } =
  await import('./playAlongHooks.ts');

function setLock(lock: object | undefined) {
  store.state = { lock };
  store.listeners.forEach((listener) => {
    listener(store.state);
  });
}

beforeEach(() => {
  store.listeners.clear();
});

it('stops watching at once when nothing is locked', () => {
  store.state = { lock: undefined };
  const stop = vi.fn();
  releaseWhenUnlocked(stop);
  expect(stop).toHaveBeenCalledOnce();
});

it('keeps watching while locked and stops on unlock', () => {
  store.state = { lock: {} };
  const stop = vi.fn();
  releaseWhenUnlocked(stop);
  setLock({});
  expect(stop).not.toHaveBeenCalled();
  setLock(undefined);
  expect(stop).toHaveBeenCalledOnce();
  expect(store.listeners.size).toBe(0);
});

it('ticks the clock on the next whole second of the song', () => {
  const report = {
    sessionId: 's',
    packageName: 's',
    appLabel: 's',
    title: null,
    artist: null,
    durationMs: null,
    playing: true,
    positionMs: 72_300,
    positionUpdatedAtMs: 0,
    speed: 1,
    spokenWord: false,
  };
  expect(msToNextSecond(report, 0)).toBe(700);
  expect(msToNextSecond({ ...report, speed: 2 }, 0)).toBe(350);
});
