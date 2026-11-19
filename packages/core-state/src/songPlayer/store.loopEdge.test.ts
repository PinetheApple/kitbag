import { KB_RESULT } from '@kitbag/core-native';
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
    ['A past B on the last beat before B', 'start', 2, RATE, RATE * 1.5],
    ['B before A on the first beat after A', 'end', 0.1, RATE * 0.5, RATE],
  ] as const)('lands %s', async (_, edge, seconds, startFrame, endFrame) => {
    const { store, commands } = await looped();
    await store.getState().moveLoopEdge(edge, seconds);
    expect(commands.mixerSetLoop).toHaveBeenCalledExactlyOnceWith(
      startFrame,
      endFrame,
    );
    expect(store.getState().loopFailure).toBe(null);
  });

  it.each([
    ['A past B', 'start', 2],
    ['B before A', 'end', 0.1],
  ] as const)(
    'refuses %s with no beat on its own side and keeps the loop',
    async (_, edge, seconds) => {
      const { store, commands } = await looped(
        songRecord({ beats: [], downbeatIndices: [] }),
      );
      const before = store.getState().loop;
      await store.getState().moveLoopEdge(edge, seconds);
      expect(commands.mixerSetLoop).not.toHaveBeenCalled();
      expect(store.getState().loopFailure).toBe('tooShort');
      expect(store.getState().loop).toEqual(before);
    },
  );

  it.each([
    ['a start dropped just before the end', 'start', 1.4, RATE, RATE * 1.5],
    ['an end dropped just after the start', 'end', 0.6, RATE * 0.5, RATE],
  ] as const)(
    'snaps %s to the nearest beat on its own side',
    async (_, edge, seconds, startFrame, endFrame) => {
      const { store, commands } = await looped();
      await store.getState().moveLoopEdge(edge, seconds);
      expect(commands.mixerSetLoop).toHaveBeenCalledExactlyOnceWith(
        startFrame,
        endFrame,
      );
      expect(store.getState().loopFailure).toBe(null);
    },
  );

  it('settles a move the mixer rejects as a failed loop, keeping the loop', async () => {
    const { store, commands } = await looped();
    const before = store.getState().loop;
    commands.mixerSetLoop.mockRejectedValueOnce(new Error('mixer gone'));
    await expect(
      store.getState().moveLoopEdge('end', 2.6),
    ).resolves.toBeUndefined();
    expect(store.getState().loopFailure).toBe('engine');
    expect(store.getState().loop).toEqual(before);
  });

  it('sends nothing when the edge snaps back to where it was', async () => {
    const { store, commands } = await looped();
    await store.getState().moveLoopEdge('start', 0.6);
    expect(commands.mixerSetLoop).not.toHaveBeenCalled();
    expect(store.getState().loopFailure).toBe(null);
  });

  it('keeps a moved edge inside the song', async () => {
    const { store, commands } = await looped(
      songRecord({ beats: [], downbeatIndices: [] }),
    );
    await store.getState().moveLoopEdge('start', -1);
    expect(commands.mixerSetLoop).toHaveBeenCalledWith(
      0,
      Math.round(RATE * 1.4),
    );
  });

  it('ignores a move while only A is marked', async () => {
    const { store, commands } = await openedSong();
    await store.getState().markLoop();
    await store.getState().moveLoopEdge('end', 2);
    expect(commands.mixerSetLoop).not.toHaveBeenCalled();
    expect(store.getState().loop.kind).toBe('armed');
  });

  it('ignores a move while the engine has not answered the last one', async () => {
    const { store, commands } = await looped();
    const answers: ((code: number) => void)[] = [];
    commands.mixerSetLoop.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          answers.push(resolve);
        }),
    );
    const first = store.getState().moveLoopEdge('end', 2.5);
    await store.getState().moveLoopEdge('end', 3);
    answers[0]?.(KB_RESULT.KB_OK);
    await first;
    expect(commands.mixerSetLoop).toHaveBeenCalledExactlyOnceWith(
      RATE * 0.5,
      RATE * 2.5,
    );
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
