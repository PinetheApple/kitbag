import { beforeEach, expect, it, vi } from 'vitest';

const stores = vi.hoisted(() => ({
  playAlong: {
    lock: undefined as { sessionId: string } | undefined,
    unlock: vi.fn(),
  },
  sessions: { pick: vi.fn() },
}));

vi.mock('@kitbag/core-state', () => ({
  getPlayAlongStore: () => ({ getState: () => stores.playAlong }),
  getMediaSessionsStore: () => ({ getState: () => stores.sessions }),
}));

const { pickSource } = await import('./pickSource.ts');

beforeEach(() => {
  vi.clearAllMocks();
  stores.playAlong.lock = { sessionId: 'spotify' };
});

it('drops the lock when another app is picked', () => {
  pickSource('ytmusic');
  expect(stores.playAlong.unlock).toHaveBeenCalledOnce();
  expect(stores.sessions.pick).toHaveBeenCalledWith('ytmusic');
});

it('keeps the lock when the followed app is picked again', () => {
  pickSource('spotify');
  expect(stores.playAlong.unlock).not.toHaveBeenCalled();
  expect(stores.sessions.pick).toHaveBeenCalledWith('spotify');
});
