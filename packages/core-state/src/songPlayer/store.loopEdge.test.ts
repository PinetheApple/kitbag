import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RATE } from '../stemPlayer/store.test-helper.ts';
import { openedSong, songRecord } from './store.test-helper.ts';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

async function looped(song = songRecord()) {
  const opened = await openedSong(song);
  opened.engine.position = RATE * 0.6;
  await opened.store.getState().markLoop();
  opened.engine.position = RATE * 1.4;
  await opened.store.getState().markLoop();
  opened.commands.mixerSetLoop.mockClear();
  return opened;
}

describe('the A|B key', () => {
  it('marks A, then B, and clears on the third tap', async () => {
    const { store, commands } = await looped();
    expect(store.getState().loop).toEqual({
      kind: 'on',
      startSec: 0.5,
      endSec: 1.5,
    });
    await store.getState().markLoop();
    expect(commands.mixerClearLoop).toHaveBeenCalledOnce();
    expect(store.getState().loop).toEqual({ kind: 'off' });
  });
});

describe('moving a loop edge', () => {
  it('snaps a moved start to the nearest beat in one engine call', async () => {
    const { store, commands } = await looped();
    await store.getState().moveLoopEdge('start', 0.9);
    expect(commands.mixerSetLoop).toHaveBeenCalledOnce();
    expect(commands.mixerSetLoop).toHaveBeenCalledWith(RATE, RATE * 1.5);
    expect(store.getState().loop).toEqual({
      kind: 'on',
      startSec: 1,
      endSec: 1.5,
    });
  });

  it('snaps a moved end to the nearest beat', async () => {
    const { store, commands } = await looped();
    await store.getState().moveLoopEdge('end', 2.6);
    expect(commands.mixerSetLoop).toHaveBeenCalledOnce();
    expect(commands.mixerSetLoop).toHaveBeenCalledWith(RATE * 0.5, RATE * 2.5);
  });

  it.each([
    ['A past B', 'start', 2],
    ['B before A', 'end', 0.1],
  ] as const)('refuses %s and keeps the loop', async (_, edge, seconds) => {
    const { store, commands } = await looped();
    await store.getState().moveLoopEdge(edge, seconds);
    expect(commands.mixerSetLoop).not.toHaveBeenCalled();
    expect(store.getState().loopFailure).toBe('tooShort');
    expect(store.getState().loop).toEqual({
      kind: 'on',
      startSec: 0.5,
      endSec: 1.5,
    });
  });

  it('moves unsnapped on a song with no grid', async () => {
    const { store, commands } = await looped(
      songRecord({ beats: [], downbeatIndices: [] }),
    );
    await store.getState().moveLoopEdge('start', 0.9);
    expect(commands.mixerSetLoop).toHaveBeenCalledWith(
      Math.round(RATE * 0.9),
      Math.round(RATE * 1.4),
    );
  });

  it('does nothing without a loop', async () => {
    const { store, commands } = await openedSong();
    await store.getState().moveLoopEdge('start', 1);
    expect(commands.mixerSetLoop).not.toHaveBeenCalled();
    expect(store.getState().loop).toEqual({ kind: 'off' });
  });
});
