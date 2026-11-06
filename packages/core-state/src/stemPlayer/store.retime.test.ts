import type { StemSetRecord } from '@kitbag/core-db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NO_LINE } from './lyrics.ts';
import {
  at,
  BARS,
  opened,
  record,
  SONG_DETAILS,
  stem,
} from './store.test-helper.ts';

const OTHER_SONG_ID = 8;
const PLAIN_ONLY: Partial<StemSetRecord> = {
  lyrics: {
    synced: null,
    plain: 'a\nb\nc',
    offsetSec: 0,
    instrumental: false,
  },
};
const OTHER_SONG = record([stem(1)], {
  ...SONG_DETAILS,
  id: OTHER_SONG_ID,
  lyrics: {
    synced: '[00:07.00]Seven\n[00:09.00]Nine',
    plain: null,
    offsetSec: 0,
    instrumental: false,
  },
});

async function recording(change: Partial<StemSetRecord> = SONG_DETAILS) {
  const song = await opened([stem(1)], change);
  song.store.getState().beginRetime(0);
  return song;
}

type Song = Awaited<ReturnType<typeof recording>>;

function tapAt({ engine, store }: Song, seconds: number) {
  engine.position = at(seconds);
  store.getState().tapRetime();
}

function timesOf({ store }: Song) {
  return store.getState().lyrics.lines.map((line) => line.timeSec);
}

function silenceWarnings() {
  return vi.spyOn(console, 'warn').mockImplementation(() => undefined);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('starting a retime', () => {
  it('starts playback when paused, so the first tap has a moving line', async () => {
    const { commands } = await recording();
    expect(commands.mixerPlay).toHaveBeenCalledTimes(1);
  });

  it('leaves playback running', async () => {
    const song = await opened([stem(1)], SONG_DETAILS);
    song.engine.playing = true;
    song.store.getState().beginRetime(0);
    expect(song.commands.mixerPause).not.toHaveBeenCalled();
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
  });

  it('stamps a tap taken while paused without advancing on a repeat', async () => {
    const song = await recording();
    tapAt(song, 2);
    tapAt(song, 2);
    expect(song.store.getState().retime).toMatchObject({
      taps: [{ line: 0, timeSec: 2 }],
      nextLine: 2,
    });
  });
});

describe('anchoring the take to where the song is', () => {
  const BUNDLED = [1.5, 2.5, 3.5, 5.5];
  const LAST_LINE = 3;
  const TWO = 2;

  async function openedAt(seconds: number) {
    const song = await opened([stem(1)], SONG_DETAILS);
    song.engine.position = at(seconds);
    return song;
  }

  function savedTimes({ records }: Song) {
    return records.saveLyricsRetimed.mock.calls.at(-1)?.[1];
  }

  it('opens on the first line at song end, where play restarts at 0', async () => {
    const song = await openedAt(9.9);
    song.store.getState().beginRetime(LAST_LINE);
    expect(song.commands.mixerSeek).toHaveBeenCalledWith(0);
    expect(song.store.getState().retime).toMatchObject({ nextLine: 0 });
  });

  it('keeps every line apart when song end restarts and taps at 1 s', async () => {
    const song = await openedAt(9.9);
    song.store.getState().beginRetime(LAST_LINE);
    tapAt(song, 1);
    await song.store.getState().commitRetime();
    expect(savedTimes(song)).toEqual([1, 2, 3, 5]);
  });

  it('follows a seek back while nothing is tapped', async () => {
    const song = await openedAt(5.6);
    song.store.getState().beginRetime(LAST_LINE);
    song.store.getState().seek(at(0.5));
    expect(song.store.getState().retime).toMatchObject({ nextLine: 0 });
    song.store.getState().seek(at(3.6));
    expect(song.store.getState().retime).toMatchObject({ nextLine: TWO });
  });

  it('keeps the next line when a seek lands past the last sung line', async () => {
    const song = await opened([stem(1)], {
      ...SONG_DETAILS,
      lyrics: {
        synced: '[00:01.00]One\n[00:02.00]Two\n[00:03.00]',
        plain: null,
        offsetSec: 0,
        instrumental: false,
      },
    });
    song.store.getState().beginRetime(1);
    song.store.getState().seek(at(4));
    expect(song.store.getState().retime).toMatchObject({ nextLine: 1 });
  });

  it('leaves the next line alone on a seek once a tap is kept', async () => {
    const song = await recording();
    tapAt(song, 1);
    song.store.getState().seek(at(5.6));
    expect(song.store.getState().retime).toMatchObject({ nextLine: TWO });
  });

  it('corrects a head that wrapped back with no seek, at the tap', async () => {
    const song = await openedAt(5.6);
    song.store.getState().beginRetime(LAST_LINE);
    tapAt(song, 0.6);
    await song.store.getState().commitRetime();
    expect(savedTimes(song)).toEqual([0.6, 1.6, 2.6, 4.6]);
  });

  it('re-anchors a tap, seek back, tap on the line playing there', async () => {
    const song = await openedAt(3.6);
    song.store.getState().beginRetime(TWO);
    tapAt(song, 3.6);
    song.store.getState().seek(at(0.5));
    tapAt(song, 0.6);
    expect(song.store.getState().retime).toMatchObject({
      taps: [{ line: 0, timeSec: 0.6 }],
      nextLine: TWO,
    });
    await song.store.getState().commitRetime();
    expect(savedTimes(song)).toEqual([0.6, 1.6, 2.6, 4.6]);
  });

  it('keeps a slightly early tap on the next line', async () => {
    const song = await openedAt(3.6);
    song.store.getState().beginRetime(TWO);
    tapAt(song, 2);
    expect(song.store.getState().retime).toMatchObject({
      taps: [{ line: TWO, timeSec: 2 }],
      nextLine: LAST_LINE,
    });
    await song.store.getState().commitRetime();
    const saved = savedTimes(song) ?? [];
    expect(saved[0]).toBe(BUNDLED[0]);
    expect(saved[TWO]).toBe(2);
  });
});

describe('Undo tap', () => {
  it('gives the line back to the next tap', async () => {
    const song = await recording();
    tapAt(song, 1);
    tapAt(song, 3);
    song.store.getState().undoRetimeTap();
    expect(song.store.getState().retime).toMatchObject({
      taps: [{ line: 0, timeSec: 1 }],
      nextLine: 2,
    });
    tapAt(song, 4);
    expect(song.store.getState().retime).toMatchObject({
      taps: [
        { line: 0, timeSec: 1 },
        { line: 2, timeSec: 4 },
      ],
      nextLine: 3,
    });
  });

  it('brings the session back from past the last line', async () => {
    const song = await opened([stem(1)], SONG_DETAILS);
    song.store.getState().beginRetime(3);
    tapAt(song, 6);
    expect(song.store.getState().retime).toMatchObject({ nextLine: NO_LINE });
    song.store.getState().undoRetimeTap();
    expect(song.store.getState().retime).toMatchObject({
      taps: [],
      nextLine: 3,
    });
  });

  it('does nothing without a tap to undo', async () => {
    const song = await recording();
    const before = song.store.getState().retime;
    song.store.getState().undoRetimeTap();
    expect(song.store.getState().retime).toEqual(before);
  });
});

describe('a tap after the position went back', () => {
  it('redoes the take from there instead of landing on a later line', async () => {
    const song = await recording();
    tapAt(song, 2);
    tapAt(song, 4);
    tapAt(song, 3);
    tapAt(song, 6);
    await song.store.getState().commitRetime();
    expect(timesOf(song)).toEqual([2, 3, 3, 6]);
  });
});

describe('Shift all lines', () => {
  it('moves every line on save, tapped or not', async () => {
    const song = await recording();
    tapAt(song, 1);
    song.store.getState().shiftRetime(1);
    song.store.getState().shiftRetime(1);
    song.store.getState().shiftRetime(-1);
    expect(song.store.getState().retime).toMatchObject({ shiftSteps: 1 });
    await song.store.getState().commitRetime();
    const [first = 0, , , last = 0] = timesOf(song);
    expect(first).toBeCloseTo(1.1);
    expect(last).toBeCloseTo(5.1);
  });

  it('saves a shift with no taps', async () => {
    const song = await recording();
    song.store.getState().shiftRetime(-1);
    await song.store.getState().commitRetime();
    expect(song.records.saveLyricsRetimed).toHaveBeenCalledTimes(1);
    expect(song.store.getState().lyrics.retimed).toBe(true);
  });

  it('has nothing to move on lines with no time', async () => {
    const song = await recording(PLAIN_ONLY);
    song.store.getState().shiftRetime(1);
    await song.store.getState().commitRetime();
    expect(song.records.saveLyricsRetimed).not.toHaveBeenCalled();
    expect(song.store.getState().retime).toEqual({ kind: 'off' });
  });
});

describe('a save that fails', () => {
  it('stays in recording with its taps and says so', async () => {
    const song = await recording();
    silenceWarnings();
    song.records.saveLyricsRetimed.mockRejectedValueOnce(new Error('disk'));
    tapAt(song, 1);
    const before = song.store.getState().retime;
    await song.store.getState().commitRetime();
    expect(song.store.getState().retime).toEqual(before);
    expect(song.store.getState().retimeFailure).toBe('notStored');
    expect(timesOf(song)).toEqual([1.5, 2.5, 3.5, 5.5]);
    expect(song.store.getState().lyrics.retimed).toBe(false);
  });

  it('can be retried, which clears the failure', async () => {
    const song = await recording();
    silenceWarnings();
    song.records.saveLyricsRetimed.mockRejectedValueOnce(new Error('disk'));
    tapAt(song, 1);
    await song.store.getState().commitRetime();
    await song.store.getState().commitRetime();
    expect(song.store.getState().retimeFailure).toBeNull();
    expect(song.store.getState().retime).toEqual({ kind: 'off' });
    expect(song.store.getState().lyrics.retimed).toBe(true);
  });

  it('keeps the retiming when a reset is not stored', async () => {
    const song = await opened([stem(1)], {
      ...SONG_DETAILS,
      lyricsRetimed: [1, 2, 3, 4],
    });
    silenceWarnings();
    song.records.saveLyricsRetimed.mockRejectedValueOnce(new Error('disk'));
    await song.store.getState().resetRetime();
    expect(timesOf(song)).toEqual([1, 2, 3, 4]);
    expect(song.store.getState().lyrics.retimed).toBe(true);
    expect(song.store.getState().retimeFailure).toBe('notStored');
  });

  it('leaves the failure behind when the session is cancelled', async () => {
    const song = await recording();
    silenceWarnings();
    song.records.saveLyricsRetimed.mockRejectedValueOnce(new Error('disk'));
    tapAt(song, 1);
    await song.store.getState().commitRetime();
    song.store.getState().cancelRetime();
    expect(song.store.getState().retimeFailure).toBeNull();
  });
});

describe('a write still running', () => {
  function heldWrite({ records }: Song) {
    let finish: () => void = () => undefined;
    records.saveLyricsRetimed.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    return () => {
      finish();
    };
  }

  it('stays in recording and takes no more input', async () => {
    const song = await recording();
    const finish = heldWrite(song);
    tapAt(song, 1);
    const pending = song.store.getState().commitRetime();
    expect(song.store.getState().retime.kind).toBe('recording');
    tapAt(song, 3);
    song.store.getState().undoRetimeTap();
    song.store.getState().shiftRetime(1);
    song.store.getState().cancelRetime();
    void song.store.getState().commitRetime();
    expect(song.store.getState().retime).toMatchObject({
      taps: [{ line: 0, timeSec: 1 }],
      shiftSteps: 0,
    });
    expect(song.records.saveLyricsRetimed).toHaveBeenCalledTimes(1);
    finish();
    await pending;
    expect(song.store.getState().retime).toEqual({ kind: 'off' });
    expect(timesOf(song)).toEqual([1, 2, 3, 5]);
  });
});

describe('another song opening during a retime', () => {
  function withOtherSong(song: Song) {
    song.records.readStemSet.mockResolvedValueOnce(OTHER_SONG);
    return song.store.getState().open(OTHER_SONG_ID, BARS);
  }

  it('ends the session without close()', async () => {
    const song = await recording();
    tapAt(song, 1);
    await withOtherSong(song);
    expect(song.store.getState().retime).toEqual({ kind: 'off' });
    expect(timesOf(song)).toEqual([7, 9]);
    expect(song.records.saveLyricsRetimed).not.toHaveBeenCalled();
  });

  it('keeps a failed save from the first song off the second', async () => {
    const song = await recording();
    silenceWarnings();
    let fail: (error: Error) => void = () => undefined;
    song.records.saveLyricsRetimed.mockImplementationOnce(
      () =>
        new Promise<void>((_, reject) => {
          fail = reject;
        }),
    );
    tapAt(song, 1);
    const pending = song.store.getState().commitRetime();
    await withOtherSong(song);
    fail(new Error('disk'));
    await pending;
    expect(timesOf(song)).toEqual([7, 9]);
    expect(song.store.getState().retimeFailure).toBeNull();
    expect(song.store.getState().setId).toBe(OTHER_SONG_ID);
  });

  it('keeps a finished save from the first song off the second', async () => {
    const song = await recording();
    let finish: () => void = () => undefined;
    song.records.saveLyricsRetimed.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    tapAt(song, 1);
    const pending = song.store.getState().commitRetime();
    await withOtherSong(song);
    finish();
    await pending;
    expect(timesOf(song)).toEqual([7, 9]);
    expect(song.store.getState().lyrics.retimed).toBe(false);
  });
});

describe('a reset while the song loads', () => {
  it('writes nothing to the song being opened', async () => {
    const song = await opened([stem(1)], SONG_DETAILS);
    let answer: (set: StemSetRecord) => void = () => undefined;
    song.records.readStemSet.mockImplementationOnce(
      () =>
        new Promise<StemSetRecord>((resolve) => {
          answer = resolve;
        }),
    );
    const loading = song.store.getState().open(OTHER_SONG_ID, BARS);
    await song.store.getState().resetRetime();
    expect(song.records.saveLyricsRetimed).not.toHaveBeenCalled();
    answer(OTHER_SONG);
    await loading;
  });
});

describe('tapping along to plain-only lyrics', () => {
  it('times the lines tapped, stores those, and follows them', async () => {
    const song = await recording(PLAIN_ONLY);
    expect(song.store.getState().retime).toMatchObject({ nextLine: 0 });
    tapAt(song, 1);
    tapAt(song, 2);
    await song.store.getState().commitRetime();
    expect(song.records.saveLyricsRetimed).toHaveBeenCalledWith(7, [1, 2]);
    expect(timesOf(song)).toEqual([1, 2, Infinity]);
    expect(song.store.getState().lyrics.synced).toBe(true);
    expect(song.store.getState().lyrics.retimed).toBe(true);
  });

  it('loads the saved times back onto the lines', async () => {
    const song = await opened([stem(1)], {
      ...PLAIN_ONLY,
      lyricsRetimed: [1, 2],
    });
    expect(timesOf(song)).toEqual([1, 2, Infinity]);
    expect(song.store.getState().lyrics.synced).toBe(true);
  });

  it('starts at the first untimed line, whatever line was asked for', async () => {
    const song = await opened([stem(1)], PLAIN_ONLY);
    song.store.getState().beginRetime(2);
    expect(song.store.getState().retime).toMatchObject({ nextLine: 0 });
  });

  it('goes back to untimed on reset', async () => {
    const song = await opened([stem(1)], {
      ...PLAIN_ONLY,
      lyricsRetimed: [1, 2],
    });
    await song.store.getState().resetRetime();
    expect(song.records.saveLyricsRetimed).toHaveBeenCalledWith(7, null);
    expect(timesOf(song)).toEqual([Infinity, Infinity, Infinity]);
    expect(song.store.getState().lyrics.synced).toBe(false);
  });
});
