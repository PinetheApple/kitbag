import { KB_RESULT } from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  at,
  BARS,
  opened,
  RATE,
  SONG_DETAILS,
  stem,
} from './store.test-helper.ts';

type Opened = Awaited<ReturnType<typeof opened>>;

const CUSTOM = { startSec: 1, endSec: 2 };
const INTRO = 0;
const VERSE = 1;

async function customLoop(
  { engine, store, commands }: Opened,
  { startSec, endSec } = CUSTOM,
) {
  engine.position = startSec * RATE;
  await store.getState().markLoop();
  engine.position = endSec * RATE;
  await store.getState().markLoop();
  commands.mixerSetLoop.mockClear();
  commands.mixerSeek.mockClear();
}

async function openedWithCustomLoop() {
  const song = await opened([stem(1)], SONG_DETAILS);
  await customLoop(song);
  return song;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('holding a section over a custom loop', () => {
  it('replaces the loop and keeps it for Undo', async () => {
    const { commands, store } = await openedWithCustomLoop();
    await store.getState().loopSection(VERSE);
    expect(commands.mixerSetLoop).toHaveBeenCalledWith(at(4), at(8));
    expect(store.getState().loop).toEqual({
      kind: 'on',
      startSec: 4,
      endSec: 8,
    });
    expect(store.getState().undoableLoop).toEqual(CUSTOM);
  });

  it('offers no Undo when no loop was replaced', async () => {
    const { store } = await opened([stem(1)], SONG_DETAILS);
    await store.getState().loopSection(VERSE);
    expect(store.getState().undoableLoop).toBeNull();
  });

  it('keeps the loop on when the section starts past the end of the song', async () => {
    const song = await opened([stem(1)], {
      sections: [
        { name: 'Late', kind: '', color: '', startSec: 12, endSec: 14 },
      ],
    });
    await customLoop(song);
    const { commands, store } = song;
    await store.getState().loopSection(0);
    expect(store.getState().loop).toMatchObject({ kind: 'on', ...CUSTOM });
    expect(store.getState().loopFailure).toBe('tooShort');
    expect(store.getState().undoableLoop).toBeNull();
    expect(commands.mixerSetLoop).not.toHaveBeenCalled();
    expect(commands.mixerSeek).not.toHaveBeenCalled();
  });

  it('keeps the loop on when the engine refuses the section', async () => {
    const { commands, store } = await openedWithCustomLoop();
    commands.mixerSetLoop.mockResolvedValueOnce(KB_RESULT.KB_ERROR_INTERNAL);
    await store.getState().loopSection(VERSE);
    expect(store.getState().loop).toMatchObject({ kind: 'on', ...CUSTOM });
    expect(store.getState().loopFailure).toBe('engine');
    expect(store.getState().undoableLoop).toBeNull();
    expect(commands.mixerSeek).not.toHaveBeenCalled();
  });

  it('clears the failure once a section loop is taken', async () => {
    const { commands, store } = await opened([stem(1)], SONG_DETAILS);
    commands.mixerSetLoop.mockResolvedValueOnce(KB_RESULT.KB_ERROR_INTERNAL);
    await store.getState().loopSection(VERSE);
    expect(store.getState().loopFailure).toBe('engine');
    await store.getState().loopSection(VERSE);
    expect(store.getState().loopFailure).toBeNull();
  });
});

describe('Undo of a replaced loop', () => {
  it('restores the bounds without moving the position', async () => {
    const { commands, store } = await openedWithCustomLoop();
    await store.getState().loopSection(VERSE);
    commands.mixerSeek.mockClear();
    await store.getState().undoLoop();
    expect(commands.mixerSetLoop).toHaveBeenLastCalledWith(at(1), at(2));
    expect(store.getState().loop).toMatchObject({ kind: 'on', ...CUSTOM });
    expect(store.getState().undoableLoop).toBeNull();
    expect(commands.mixerSeek).not.toHaveBeenCalled();
  });

  it('stays available when the engine refuses it', async () => {
    const { commands, store } = await openedWithCustomLoop();
    await store.getState().loopSection(VERSE);
    commands.mixerSetLoop.mockResolvedValueOnce(KB_RESULT.KB_ERROR_INTERNAL);
    await store.getState().undoLoop();
    expect(store.getState().loopFailure).toBe('engine');
    expect(store.getState().loop).toMatchObject({ startSec: 4, endSec: 8 });
    expect(store.getState().undoableLoop).toEqual(CUSTOM);
  });

  it('does nothing with nothing to restore', async () => {
    const { commands, store } = await opened([stem(1)], SONG_DETAILS);
    await store.getState().undoLoop();
    expect(commands.mixerSetLoop).not.toHaveBeenCalled();
  });

  it('is gone once the user clears the loop', async () => {
    const { store } = await openedWithCustomLoop();
    await store.getState().loopSection(VERSE);
    await store.getState().markLoop();
    expect(store.getState().undoableLoop).toBeNull();
  });

  it('is gone when the song closes or another song opens', async () => {
    const closing = await openedWithCustomLoop();
    await closing.store.getState().loopSection(VERSE);
    closing.store.getState().close();
    expect(closing.store.getState().undoableLoop).toBeNull();
    const reopening = await openedWithCustomLoop();
    await reopening.store.getState().loopSection(VERSE);
    await reopening.store.getState().open(7, BARS);
    expect(reopening.store.getState().undoableLoop).toBeNull();
  });

  it('applies nothing to a song opened while the engine answered', async () => {
    const { commands, store } = await openedWithCustomLoop();
    await store.getState().loopSection(VERSE);
    let answer: (code: number) => void = () => undefined;
    commands.mixerSetLoop.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          answer = resolve;
        }),
    );
    const pending = store.getState().undoLoop();
    await store.getState().open(7, BARS);
    answer(KB_RESULT.KB_OK);
    await pending;
    expect(store.getState().loop).toEqual({ kind: 'off' });
    expect(store.getState().undoableLoop).toBeNull();
  });
});

describe('tapping a section during a loop', () => {
  it('clears the loop and jumps when the section starts outside it, with Undo', async () => {
    const { commands, store } = await openedWithCustomLoop();
    await store.getState().jumpToSection(VERSE);
    expect(commands.mixerClearLoop).toHaveBeenCalledTimes(1);
    expect(commands.mixerSeek).toHaveBeenCalledWith(at(4));
    expect(store.getState().loop).toEqual({ kind: 'off' });
    expect(store.getState().undoableLoop).toEqual(CUSTOM);
    commands.mixerSeek.mockClear();
    await store.getState().undoLoop();
    expect(commands.mixerSetLoop).toHaveBeenLastCalledWith(at(1), at(2));
    expect(store.getState().loop).toMatchObject({ kind: 'on', ...CUSTOM });
    expect(commands.mixerSeek).not.toHaveBeenCalled();
  });

  it('only seeks when the section starts inside the loop', async () => {
    const song = await opened([stem(1)], SONG_DETAILS);
    await customLoop(song, { startSec: 0, endSec: 3 });
    const { commands, store } = song;
    await store.getState().jumpToSection(INTRO);
    expect(commands.mixerClearLoop).not.toHaveBeenCalled();
    expect(commands.mixerSeek).toHaveBeenCalledWith(at(0));
    expect(store.getState().loop).toMatchObject({ kind: 'on', endSec: 3 });
    expect(store.getState().undoableLoop).toBeNull();
  });

  it('does not jump out of a loop the engine would not clear', async () => {
    const { commands, store } = await openedWithCustomLoop();
    commands.mixerClearLoop.mockResolvedValueOnce(KB_RESULT.KB_ERROR_INTERNAL);
    await store.getState().jumpToSection(VERSE);
    expect(commands.mixerSeek).not.toHaveBeenCalled();
    expect(store.getState().loop).toMatchObject({ kind: 'on', ...CUSTOM });
    expect(store.getState().loopFailure).toBe('engine');
    expect(store.getState().undoableLoop).toBeNull();
  });

  it('keeps the Undo through a section hold after the tap', async () => {
    const { store } = await openedWithCustomLoop();
    await store.getState().jumpToSection(VERSE);
    await store.getState().loopSection(VERSE);
    expect(store.getState().undoableLoop).toEqual(CUSTOM);
  });
});
