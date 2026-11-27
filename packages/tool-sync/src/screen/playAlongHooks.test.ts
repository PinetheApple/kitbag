// react-test-renderer is deprecated, but it alone runs effects with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement } from 'react';
import { create } from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';

const SHOWN_BPM = 120;

interface State {
  readonly lock: object | undefined;
  readonly bpm?: number;
}
type Listener = (state: State) => void;

const store = vi.hoisted(() => {
  const state: { lock: object | undefined; bpm?: number } = {
    lock: undefined,
  };
  return {
    state,
    stopWatching: vi.fn(),
    watchLibrary: vi.fn(),
    listeners: new Set<(state: { lock: object | undefined }) => void>(),
  };
});

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  getPlayAlongStore: () => ({
    getState: () => ({ ...store.state, watchLibrary: store.watchLibrary }),
    subscribe: (listener: Listener) => {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
  }),
}));

const { msToNextSecond, releaseWhenUnlocked, useLibraryWatch, useTempoLine } =
  await import('./playAlongHooks.ts');

function setLock(lock: object | undefined) {
  store.state = { lock };
  store.listeners.forEach((listener) => {
    listener(store.state);
  });
}

beforeEach(() => {
  store.listeners.clear();
  vi.clearAllMocks();
  store.watchLibrary.mockReturnValue(store.stopWatching);
});

it('watches the library while the screen is mounted', () => {
  const Probe = () => {
    useLibraryWatch();
    return null;
  };
  let tree: ReturnType<typeof create> | undefined;
  act(() => {
    tree = create(createElement(Probe));
  });
  expect(store.watchLibrary).toHaveBeenCalledOnce();
  expect(store.stopWatching).not.toHaveBeenCalled();
  act(() => {
    tree?.unmount();
  });
  expect(store.stopWatching).toHaveBeenCalledOnce();
});

it("shows the play along tempo, not the ladder's", () => {
  store.state = { lock: undefined, bpm: SHOWN_BPM };
  let shown: number | null | undefined;
  const Probe = () => {
    shown = useTempoLine().bpm;
    return null;
  };
  act(() => {
    create(createElement(Probe));
  });
  expect(shown).toBe(SHOWN_BPM);
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
