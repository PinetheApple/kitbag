import { describe, expect, it, vi } from 'vitest';

import type { PermissionAnswer } from '../permission.ts';
import {
  createNotificationPermissionStore,
  notificationAction,
  type NotificationAsk,
  type NotificationPermissionSource,
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
  const request = vi.fn(() => Promise.resolve(answer));
  const openSettings = vi.fn();
  const save = vi.fn<(ask: NotificationAsk) => void>();
  const source: NotificationPermissionSource = {
    required,
    granted: () => Promise.resolve(granted),
    request,
    openSettings,
  };
  const store = createNotificationPermissionStore(source, {
    load: () => ask,
    save,
  });
  return { store, request, openSettings, save };
}

describe('notification permission on playback start', () => {
  it('prompts with context on the first start, and remembers it asked', async () => {
    const { store, request, save } = fakes();
    await store.getState().playbackStarted();
    expect(store.getState().prompting).toBe(true);
    expect(request).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith('asked');
  });

  it('asks the system only after Allow', async () => {
    const { store, request } = fakes({ answer: 'granted' });
    await store.getState().playbackStarted();
    await store.getState().allow();
    expect(request).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({ prompting: false, granted: true });
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
    const { store, save } = fakes();
    await Promise.all([
      store.getState().playbackStarted(),
      store.getState().playbackStarted(),
    ]);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when the permission is already granted', async () => {
    const { store, request } = fakes({ granted: true });
    await store.getState().playbackStarted();
    expect(store.getState()).toMatchObject({ prompting: false, granted: true });
    expect(request).not.toHaveBeenCalled();
  });

  it('never prompts where the platform has no runtime permission', async () => {
    const { store, save } = fakes({ required: false });
    await store.getState().playbackStarted();
    expect(store.getState().prompting).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('remembers when the system will not show the dialog again', async () => {
    const { store, save } = fakes({ answer: 'blocked' });
    await store.getState().playbackStarted();
    await store.getState().allow();
    expect(store.getState().ask).toBe('blocked');
    expect(save).toHaveBeenLastCalledWith('blocked');
  });
});

describe('notification permission retry from Settings', () => {
  it('requests again while the system still shows the dialog', async () => {
    const { store, request, openSettings } = fakes({
      ask: 'asked',
      answer: 'granted',
    });
    await store.getState().refresh();
    await store.getState().retry();
    expect(request).toHaveBeenCalledTimes(1);
    expect(openSettings).not.toHaveBeenCalled();
    expect(store.getState().granted).toBe(true);
  });

  it('opens the app settings once the system will not ask', async () => {
    const { store, request, openSettings } = fakes({ ask: 'blocked' });
    await store.getState().refresh();
    await store.getState().retry();
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(request).not.toHaveBeenCalled();
  });

  it('does nothing when the permission is granted', async () => {
    const { store, request, openSettings } = fakes({ granted: true });
    await store.getState().refresh();
    await store.getState().retry();
    expect(request).not.toHaveBeenCalled();
    expect(openSettings).not.toHaveBeenCalled();
  });
});

describe('notificationAction', () => {
  it.each([
    [{ required: true, granted: true, ask: 'blocked' }, 'none'],
    [{ required: true, granted: undefined, ask: 'asked' }, 'none'],
    [{ required: false, granted: false, ask: 'never' }, 'none'],
    [{ required: true, granted: false, ask: 'never' }, 'request'],
    [{ required: true, granted: false, ask: 'asked' }, 'request'],
    [{ required: true, granted: false, ask: 'blocked' }, 'openSettings'],
  ] as const)('maps %o to %s', (state, action) => {
    expect(notificationAction(state)).toBe(action);
  });
});
