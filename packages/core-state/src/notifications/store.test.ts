import { describe, expect, it, vi } from 'vitest';

import type { PermissionAnswer } from '../permission.ts';
import {
  createNotificationPermissionStore,
  notificationAction,
  type NotificationAsk,
  type NotificationPermissionRuntime,
} from './store.ts';

function fakes({
  ask = 'never',
  granted = false,
  answer = 'denied',
  required = true,
}: {
  readonly ask?: NotificationAsk;
  readonly granted?: boolean;
  readonly answer?: PermissionAnswer;
  readonly required?: boolean;
} = {}) {
  let stored = ask;
  const check = vi.fn(() => Promise.resolve(granted));
  const request = vi.fn(() => Promise.resolve(answer));
  const openSettings = vi.fn();
  const save = vi.fn((next: NotificationAsk) => {
    stored = next;
  });
  const runtime: NotificationPermissionRuntime = {
    source: { required, granted: check, request, openSettings },
    persistence: { load: () => stored, save },
  };
  const create = () => createNotificationPermissionStore(runtime);
  return { store: create(), create, check, request, openSettings, save };
}

describe('notification permission on playback start', () => {
  it('prompts with context on the first start, and remembers it once answered', async () => {
    const { store, request, save } = fakes();
    await store.getState().playbackStarted();
    expect(store.getState().prompting).toBe(true);
    expect(request).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    store.getState().notNow();
    expect(save).toHaveBeenCalledWith('asked');
  });

  it('prompts again after a relaunch when the prompt was never answered', async () => {
    const { store, create } = fakes();
    await store.getState().playbackStarted();
    expect(store.getState().prompting).toBe(true);

    const relaunched = create();
    await relaunched.getState().playbackStarted();
    expect(relaunched.getState().prompting).toBe(true);
  });

  it('asks the system only after Allow, and remembers it', async () => {
    const { store, request, save, openSettings } = fakes({
      answer: 'granted',
    });
    await store.getState().playbackStarted();
    await store.getState().allow();
    expect(request).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({ prompting: false, granted: true });
    expect(save).toHaveBeenLastCalledWith('asked');
    expect(openSettings).not.toHaveBeenCalled();
  });

  it('does not prompt again on later starts once declined', async () => {
    const first = fakes();
    await first.store.getState().playbackStarted();
    first.store.getState().notNow();
    await first.store.getState().playbackStarted();
    expect(first.store.getState().prompting).toBe(false);

    const relaunched = fakes({ ask: 'asked' });
    await relaunched.store.getState().playbackStarted();
    expect(relaunched.store.getState().prompting).toBe(false);
    expect(relaunched.request).not.toHaveBeenCalled();
  });

  it('prompts once when two players start together', async () => {
    const { store, check } = fakes();
    await Promise.all([
      store.getState().playbackStarted(),
      store.getState().playbackStarted(),
    ]);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('stays quiet, and remembers it, when the permission is already granted', async () => {
    const { store, request, save } = fakes({ granted: true });
    await store.getState().playbackStarted();
    expect(store.getState()).toMatchObject({ prompting: false, granted: true });
    expect(request).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith('asked');
  });

  it('never prompts where the platform has no runtime permission', async () => {
    const { store, check, save } = fakes({ required: false });
    await store.getState().playbackStarted();
    expect(store.getState().prompting).toBe(false);
    expect(check).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('opens the app settings when Allow meets a dialog the system will not show', async () => {
    const { store, openSettings } = fakes({ answer: 'blocked' });
    await store.getState().playbackStarted();
    await store.getState().allow();
    expect(openSettings).toHaveBeenCalledTimes(1);
  });
});

describe('enabling notifications from Settings', () => {
  it('asks the system when it has never been asked', async () => {
    const { store, request, openSettings, save } = fakes({
      answer: 'granted',
    });
    await store.getState().refresh();
    await store.getState().enable();
    expect(request).toHaveBeenCalledTimes(1);
    expect(openSettings).not.toHaveBeenCalled();
    expect(store.getState().granted).toBe(true);
    expect(save).toHaveBeenCalledWith('asked');
  });

  it('opens the app settings once it has been asked', async () => {
    const { store, request, openSettings } = fakes({ ask: 'asked' });
    await store.getState().refresh();
    await store.getState().enable();
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(request).not.toHaveBeenCalled();
  });

  it('does nothing when the permission is granted', async () => {
    const { store, request, openSettings } = fakes({ granted: true });
    await store.getState().refresh();
    await store.getState().enable();
    expect(request).not.toHaveBeenCalled();
    expect(openSettings).not.toHaveBeenCalled();
  });
});

describe('notificationAction', () => {
  it.each([
    [{ required: true, granted: true, ask: 'asked' }, 'none'],
    [{ required: true, granted: undefined, ask: 'asked' }, 'none'],
    [{ required: false, granted: false, ask: 'never' }, 'none'],
    [{ required: true, granted: false, ask: 'never' }, 'request'],
    [{ required: true, granted: false, ask: 'asked' }, 'openSettings'],
  ] as const)('maps %o to %s', (state, action) => {
    expect(notificationAction(state)).toBe(action);
  });
});
