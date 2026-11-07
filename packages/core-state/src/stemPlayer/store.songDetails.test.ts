import { KB_RESULT } from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NO_LINE } from './lyrics.ts';
import { at, BARS, opened, SONG_DETAILS, stem } from './store.test-helper.ts';

function timesOf(store: Awaited<ReturnType<typeof opened>>['store']) {
  return store.getState().lyrics.lines.map((line) => line.timeSec);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('sections in the stem player', () => {
  it('loads them in song order with the song', async () => {
    const { store } = await opened([stem(1)], SONG_DETAILS);
    expect(store.getState().sections.map((s) => s.name)).toEqual([
      'Intro',
      'Verse',
      'Outro',
    ]);
  });

  it('jumps to a section start through seek', async () => {
    const { commands, store } = await opened([stem(1)], SONG_DETAILS);
    await store.getState().jumpToSection(1);
    expect(commands.mixerSeek).toHaveBeenCalledWith(at(4));
    await store.getState().jumpToSection(9);
    expect(commands.mixerSeek).toHaveBeenCalledTimes(1);
  });

  it('loops a section through the A-B loop and starts it', async () => {
    const { commands, store } = await opened([stem(1)], SONG_DETAILS);
    await store.getState().loopSection(1);
    expect(commands.mixerSetLoop).toHaveBeenCalledWith(at(4), at(8));
    expect(store.getState().loop).toEqual({
      kind: 'on',
      startSec: 4,
      endSec: 8,
    });
    expect(commands.mixerSeek).toHaveBeenCalledWith(at(4));
    await store.getState().markLoop();
    expect(commands.mixerClearLoop).toHaveBeenCalledTimes(1);
    expect(store.getState().loop).toEqual({ kind: 'off' });
  });

  it('ends a section loop at the end of the song', async () => {
    const { commands, store } = await opened([stem(1)], SONG_DETAILS);
    await store.getState().loopSection(2);
    expect(commands.mixerSetLoop).toHaveBeenCalledWith(at(8), at(10));
  });

  it('shows no section loop the engine refused, and does not move', async () => {
    const { commands, store } = await opened([stem(1)], SONG_DETAILS);
    commands.mixerSetLoop.mockResolvedValueOnce(KB_RESULT.KB_ERROR_INTERNAL);
    await store.getState().loopSection(0);
    expect(store.getState().loop).toEqual({ kind: 'off' });
    expect(store.getState().loopFailure).toBe('engine');
    expect(commands.mixerSeek).not.toHaveBeenCalled();
  });

  it('forgets the sections when the song closes', async () => {
    const { store } = await opened([stem(1)], SONG_DETAILS);
    store.getState().close();
    expect(store.getState().sections).toEqual([]);
  });
});

describe('synced lyrics in the stem player', () => {
  it('loads them shifted by the bundle offset', async () => {
    const { store } = await opened([stem(1)], SONG_DETAILS);
    expect(timesOf(store)).toEqual([1.5, 2.5, 3.5, 5.5]);
  });

  it('loads a saved retiming', async () => {
    const { store } = await opened([stem(1)], {
      ...SONG_DETAILS,
      lyricsRetimed: [1, 2, 3, 4],
    });
    expect(timesOf(store)).toEqual([1, 2, 3, 4]);
    expect(store.getState().lyrics.retimed).toBe(true);
  });

  it('retimes the sung lines from taps in song time and saves them', async () => {
    const { engine, records, store } = await opened([stem(1)], SONG_DETAILS);
    store.getState().beginRetime(0);
    expect(store.getState().retime).toEqual({
      kind: 'recording',
      taps: [],
      nextLine: 0,
      shiftSteps: 0,
    });
    engine.position = at(1.25);
    store.getState().tapRetime();
    expect(store.getState().retime).toMatchObject({ nextLine: 2 });
    engine.position = at(3.75);
    store.getState().tapRetime();
    await store.getState().commitRetime();
    expect(timesOf(store)).toEqual([1.25, 2.25, 3.75, 5.75]);
    expect(store.getState().retime).toEqual({ kind: 'off' });
    expect(store.getState().lyrics.retimed).toBe(true);
    expect(records.saveLyricsRetimed).toHaveBeenCalledWith(
      7,
      [1.25, 2.25, 3.75, 5.75],
    );
  });

  it('ignores taps past the last line', async () => {
    const { engine, store } = await opened([stem(1)], SONG_DETAILS);
    store.getState().beginRetime(3);
    engine.position = at(6);
    store.getState().tapRetime();
    engine.position = at(7);
    store.getState().tapRetime();
    expect(store.getState().retime).toEqual({
      kind: 'recording',
      taps: [{ line: 3, timeSec: 6 }],
      nextLine: NO_LINE,
      shiftSteps: 0,
    });
  });

  it('keeps the timing when a session is cancelled or has no taps', async () => {
    const { engine, records, store } = await opened([stem(1)], SONG_DETAILS);
    store.getState().beginRetime(0);
    engine.position = at(2);
    store.getState().tapRetime();
    store.getState().cancelRetime();
    expect(store.getState().retime).toEqual({ kind: 'off' });
    store.getState().beginRetime(0);
    await store.getState().commitRetime();
    expect(timesOf(store)).toEqual([1.5, 2.5, 3.5, 5.5]);
    expect(records.saveLyricsRetimed).not.toHaveBeenCalled();
  });

  it('does not record without lyrics', async () => {
    const { store } = await opened([stem(1)]);
    store.getState().beginRetime(0);
    expect(store.getState().retime).toEqual({ kind: 'off' });
  });

  it('resets to the bundle timing and clears the saved retiming', async () => {
    const { records, store } = await opened([stem(1)], {
      ...SONG_DETAILS,
      lyricsRetimed: [1, 2, 3, 4],
    });
    await store.getState().resetRetime();
    expect(timesOf(store)).toEqual([1.5, 2.5, 3.5, 5.5]);
    expect(store.getState().lyrics.retimed).toBe(false);
    expect(records.saveLyricsRetimed).toHaveBeenCalledWith(7, null);
  });

  it('drops a session when the song closes and reopens', async () => {
    const { store } = await opened([stem(1)], SONG_DETAILS);
    store.getState().beginRetime(0);
    store.getState().close();
    await store.getState().open(7, BARS);
    expect(store.getState().retime).toEqual({ kind: 'off' });
  });
});
