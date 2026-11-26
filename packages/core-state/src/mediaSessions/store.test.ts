import type { MediaSessionSnapshot } from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

import type { SeenFlagPersistence } from '../firstUse/store.ts';
import {
  createMediaSessionsStore,
  type MediaSessionsSource,
  type SessionChooser,
} from './store.ts';

const SEEK_MS = 42000;

function session(
  sessionId: string,
  overrides: Partial<MediaSessionSnapshot> = {},
): MediaSessionSnapshot {
  return {
    sessionId,
    packageName: sessionId,
    appLabel: sessionId,
    title: null,
    artist: null,
    durationMs: null,
    playing: false,
    positionMs: 0,
    positionUpdatedAtMs: 0,
    speed: 0,
    spokenWord: false,
    ...overrides,
  };
}

const first = session('first');
const second = session('second', { playing: true });

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

interface FakeOptions {
  readonly enabled?: boolean;
  readonly declined?: boolean;
}

function fakes({ enabled = true, declined = false }: FakeOptions = {}) {
  let deliver: (sessions: readonly MediaSessionSnapshot[]) => void = () =>
    undefined;
  const unsubscribe = vi.fn();
  const source = {
    subscribe: vi.fn(
      (listener: (sessions: readonly MediaSessionSnapshot[]) => void) => {
        deliver = listener;
        return unsubscribe;
      },
    ),
    command: vi.fn(),
    listenerEnabled: vi.fn(() => Promise.resolve(enabled)),
    openListenerSettings: vi.fn(() => Promise.resolve(true)),
    rearm: vi.fn(),
  } satisfies MediaSessionsSource;
  const choose = vi.fn<SessionChooser>(
    (sessions, { pickedId }) => pickedId ?? sessions[0]?.sessionId,
  );
  const explainer = {
    load: vi.fn(() => declined),
    save: vi.fn(),
  } satisfies SeenFlagPersistence;
  const store = createMediaSessionsStore({
    source,
    choose,
    explainerDeclined: explainer,
  });
  const push = (sessions: readonly MediaSessionSnapshot[]) => {
    deliver(sessions);
  };
  return { store, source, choose, explainer, unsubscribe, push };
}

describe('media sessions store', () => {
  it('takes pushed sessions and the chooser verdict while watched', () => {
    const { store, push, choose } = fakes();
    store.getState().watch();
    push([first, second]);
    expect(store.getState()).toMatchObject({
      sessions: [first, second],
      chosenId: 'first',
    });
    expect(choose).toHaveBeenLastCalledWith([first, second], {
      chosenId: undefined,
      pickedId: undefined,
    });
  });

  it('hands the chooser its previous choice so it can hold it', () => {
    const { store, push, choose } = fakes();
    store.getState().watch();
    push([first]);
    push([second, first]);
    expect(choose).toHaveBeenLastCalledWith([second, first], {
      chosenId: 'first',
      pickedId: undefined,
    });
  });

  it('checks listener access when watching starts', async () => {
    const { store, source } = fakes({ enabled: false });
    store.getState().watch();
    await settle();
    expect(source.listenerEnabled).toHaveBeenCalledOnce();
    expect(store.getState().access).toBe(false);
  });

  it('unsubscribes when the watcher leaves', () => {
    const { store, unsubscribe } = fakes();
    const unwatch = store.getState().watch();
    unwatch();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('keeps a pick only while its session is live', () => {
    const { store, push } = fakes();
    store.getState().watch();
    push([first, second]);
    store.getState().pick('second');
    expect(store.getState()).toMatchObject({
      pickedId: 'second',
      chosenId: 'second',
    });
    push([first]);
    expect(store.getState()).toMatchObject({
      pickedId: undefined,
      chosenId: 'first',
    });
  });

  it('ignores a pick of a session that is not live', () => {
    const { store, push } = fakes();
    store.getState().watch();
    push([first]);
    store.getState().pick('gone');
    expect(store.getState()).toMatchObject({
      pickedId: undefined,
      chosenId: 'first',
    });
  });

  it('sends commands to the chosen session', () => {
    const { store, push, source } = fakes();
    store.getState().watch();
    push([first, second]);
    store.getState().pick('second');
    store.getState().command({ type: 'pause' });
    store.getState().command({ type: 'seekTo', positionMs: SEEK_MS });
    expect(source.command.mock.calls).toEqual([
      ['second', { type: 'pause' }],
      ['second', { type: 'seekTo', positionMs: SEEK_MS }],
    ]);
  });

  it('sends nothing when no session is chosen', () => {
    const { store, source } = fakes();
    store.getState().command({ type: 'play' });
    expect(source.command).not.toHaveBeenCalled();
  });

  it('opens the listener settings and says whether they opened', async () => {
    const { store, source } = fakes();
    await expect(store.getState().openSettings()).resolves.toBe(true);
    expect(source.openListenerSettings).toHaveBeenCalledOnce();
  });

  it('reports access granted on refresh and re-arms the listener', async () => {
    const { store, source } = fakes();
    await store.getState().refresh();
    expect(store.getState().access).toBe(true);
    expect(source.rearm).toHaveBeenCalledOnce();
  });

  it('re-arms on refresh when access is off too, so native drops its sessions', async () => {
    const { store, source } = fakes({ enabled: false });
    await store.getState().refresh();
    expect(source.rearm).toHaveBeenCalledOnce();
  });

  it('drops the sessions when refresh finds access revoked', async () => {
    const { store, push } = fakes({ enabled: false });
    store.getState().watch();
    push([first]);
    await store.getState().refresh();
    expect(store.getState()).toMatchObject({
      access: false,
      sessions: [],
      chosenId: undefined,
    });
  });

  it('offers the access explainer on a fresh install', () => {
    const { store } = fakes();
    expect(store.getState().explainerDeclined).toBe(false);
  });

  it('remembers a "Not now" from an earlier launch', () => {
    const { store } = fakes({ declined: true });
    expect(store.getState().explainerDeclined).toBe(true);
  });

  it('saves "Not now" once, however often it is tapped', () => {
    const { store, explainer } = fakes();
    store.getState().declineExplainer();
    store.getState().declineExplainer();
    expect(store.getState().explainerDeclined).toBe(true);
    expect(explainer.save).toHaveBeenCalledOnce();
  });
});
