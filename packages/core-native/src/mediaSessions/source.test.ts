import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MediaSessionsEvent } from '../NativeKitbagMediaSessions';

const MUSIC_APP = 'org.example.music';
const SPOKEN_APP = 'de.danoeh.antennapod';
const MUSIC_ID = `${MUSIC_APP}/1`;
const POSITION_MS = 61000;
const DURATION_MS = 240000;
const UPDATED_AT_MS = 5000;
const SEEK_MS = 30000;

const event: MediaSessionsEvent = {
  sessions: [
    {
      sessionId: MUSIC_ID,
      packageName: MUSIC_APP,
      appLabel: 'Music',
      title: 'Song',
      artist: 'Band',
      durationMs: DURATION_MS,
      playing: true,
      positionMs: POSITION_MS,
      positionUpdatedAtMs: UPDATED_AT_MS,
      speed: 1,
    },
    {
      sessionId: `${SPOKEN_APP}/2`,
      packageName: SPOKEN_APP,
      appLabel: 'Podcasts',
      title: null,
      artist: null,
      durationMs: null,
      playing: false,
      positionMs: null,
      positionUpdatedAtMs: 0,
      speed: 0,
    },
  ],
};

const native = vi.hoisted(() => {
  const state = {
    listener: undefined as ((event: unknown) => void) | undefined,
  };
  const remove = vi.fn();
  return {
    state,
    remove,
    module: {
      onSessions: vi.fn((listener: (event: unknown) => void) => {
        state.listener = listener;
        return { remove };
      }),
      setWatching: vi.fn(),
      listenerEnabled: vi.fn(() => Promise.resolve(true)),
      openListenerSettings: vi.fn(() => Promise.resolve(true)),
      play: vi.fn(),
      pause: vi.fn(),
      skipToNext: vi.fn(),
      skipToPrevious: vi.fn(),
      seekTo: vi.fn(),
    },
  };
});

vi.mock('../NativeKitbagMediaSessions', () => ({
  getKitbagMediaSessions: () => native.module,
}));

const {
  isNotificationListenerEnabled,
  mediaSessionCommand,
  openNotificationListenerSettings,
  rearmMediaSessions,
  subscribeMediaSessions,
  toMediaSessionSnapshots,
} = await import('./source.ts');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('toMediaSessionSnapshots', () => {
  it('keeps every native field and flags spoken-word apps', () => {
    const [music, spoken] = event.sessions;
    expect(toMediaSessionSnapshots(event)).toEqual([
      { ...music, spokenWord: false },
      { ...spoken, spokenWord: true },
    ]);
  });
});

describe('subscribeMediaSessions', () => {
  it('subscribes before it asks native to start watching', () => {
    const stop = subscribeMediaSessions(vi.fn());
    const subscribed = native.module.onSessions.mock.invocationCallOrder[0];
    const started = native.module.setWatching.mock.invocationCallOrder[0];
    expect(subscribed).toBeLessThan(started ?? 0);
    expect(native.module.setWatching).toHaveBeenCalledWith(true);
    stop();
  });

  it('delivers each pushed event, mapped', () => {
    const seen = vi.fn();
    const stop = subscribeMediaSessions(seen);
    native.state.listener?.(event);
    expect(seen).toHaveBeenCalledWith(toMediaSessionSnapshots(event));
    stop();
  });

  it('starts native once for two listeners and hands the second the latest sessions', () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = subscribeMediaSessions(first);
    native.state.listener?.(event);
    const stopSecond = subscribeMediaSessions(second);
    expect(native.module.setWatching).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith(toMediaSessionSnapshots(event));
    stopFirst();
    expect(native.module.setWatching).not.toHaveBeenCalledWith(false);
    stopSecond();
    expect(native.module.setWatching).toHaveBeenLastCalledWith(false);
    expect(native.remove).toHaveBeenCalledOnce();
  });

  it('ignores a second unsubscribe from the same listener', () => {
    const stopKept = subscribeMediaSessions(vi.fn());
    const stop = subscribeMediaSessions(vi.fn());
    stop();
    stop();
    expect(native.module.setWatching).not.toHaveBeenCalledWith(false);
    stopKept();
  });
});

describe('mediaSessionCommand', () => {
  it('sends each command to the session it names', () => {
    mediaSessionCommand(MUSIC_ID, { type: 'play' });
    mediaSessionCommand(MUSIC_ID, { type: 'pause' });
    mediaSessionCommand(MUSIC_ID, { type: 'next' });
    mediaSessionCommand(MUSIC_ID, { type: 'previous' });
    mediaSessionCommand(MUSIC_ID, { type: 'seekTo', positionMs: SEEK_MS });
    expect(native.module.play).toHaveBeenCalledWith(MUSIC_ID);
    expect(native.module.pause).toHaveBeenCalledWith(MUSIC_ID);
    expect(native.module.skipToNext).toHaveBeenCalledWith(MUSIC_ID);
    expect(native.module.skipToPrevious).toHaveBeenCalledWith(MUSIC_ID);
    expect(native.module.seekTo).toHaveBeenCalledWith(MUSIC_ID, SEEK_MS);
  });
});

describe('notification listener access', () => {
  it('asks native whether access is on without starting anything', async () => {
    await expect(isNotificationListenerEnabled()).resolves.toBe(true);
    expect(native.module.setWatching).not.toHaveBeenCalled();
  });

  it('reports whether the settings screen opened', async () => {
    native.module.openListenerSettings.mockResolvedValueOnce(false);
    await expect(openNotificationListenerSettings()).resolves.toBe(false);
  });
});

describe('rearmMediaSessions', () => {
  it('asks native to listen again only while something is subscribed', () => {
    rearmMediaSessions();
    expect(native.module.setWatching).not.toHaveBeenCalled();
    const stop = subscribeMediaSessions(vi.fn());
    rearmMediaSessions();
    expect(native.module.setWatching.mock.calls).toEqual([[true], [true]]);
    stop();
  });
});
