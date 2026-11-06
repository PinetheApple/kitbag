import type { StoredLyrics } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import {
  firstRetimeLine,
  lyricLineAt,
  NO_LINE,
  nextSungLine,
  retimedTimes,
  shiftedTimes,
  songLyrics,
  storedTimes,
  takeAfterTap,
} from './lyrics.ts';

const SYNCED = '[00:10.00]One\n[00:12.00]\n[00:14.00]Two\n[00:18.00]Three';

function stored(change: Partial<StoredLyrics> = {}): StoredLyrics {
  return {
    synced: SYNCED,
    plain: 'One\nTwo\nThree',
    offsetSec: 0,
    instrumental: false,
    ...change,
  };
}

const times = (lyrics: ReturnType<typeof songLyrics>) =>
  lyrics.lines.map((line) => line.timeSec);

describe('song lyrics', () => {
  it('shifts every synced line by the bundle offset', () => {
    const lyrics = songLyrics(stored({ offsetSec: -0.5 }), null);
    expect(times(lyrics)).toEqual([9.5, 11.5, 13.5, 17.5]);
    expect(lyrics.lines.map((line) => line.text)).toEqual([
      'One',
      '',
      'Two',
      'Three',
    ]);
    expect(lyrics.retimed).toBe(false);
  });

  it('plays a saved retiming instead of the offset', () => {
    const lyrics = songLyrics(stored({ offsetSec: -0.5 }), [9, 11, 15, 19]);
    expect(times(lyrics)).toEqual([9, 11, 15, 19]);
    expect(lyrics.bundledTimes).toEqual([9.5, 11.5, 13.5, 17.5]);
    expect(lyrics.retimed).toBe(true);
  });

  it.each([
    ['a retiming of other lyrics', [9, 11, 15]],
    ['a retiming out of order', [9, 16, 15, 19]],
  ])('falls back to the offset for %s', (_, saved) => {
    const lyrics = songLyrics(stored({ offsetSec: 1 }), saved);
    expect(times(lyrics)).toEqual([11, 13, 15, 19]);
    expect(lyrics.retimed).toBe(false);
  });

  it('has no lines for instrumental or missing lyrics', () => {
    const instrumental = songLyrics(
      stored({ synced: null, plain: null, instrumental: true }),
      null,
    );
    expect(instrumental.lines).toEqual([]);
    expect(instrumental.instrumental).toBe(true);
    expect(songLyrics(null, null).lines).toEqual([]);
  });

  it('shows no synced lines for a song marked instrumental', () => {
    expect(songLyrics(stored({ instrumental: true }), null).lines).toEqual([]);
  });
});

describe('the lyric line at a song time', () => {
  const { lines } = songLyrics(stored(), null);

  it('is the last line that has started', () => {
    expect(lyricLineAt(lines, 10)).toBe(0);
    expect(lyricLineAt(lines, 11.99)).toBe(0);
    expect(lyricLineAt(lines, 12)).toBe(1);
    expect(lyricLineAt(lines, 17.9)).toBe(2);
    expect(lyricLineAt(lines, 400)).toBe(3);
  });

  it('is no line before the first one starts, or without lyrics', () => {
    expect(lyricLineAt(lines, 9.99)).toBe(NO_LINE);
    expect(lyricLineAt([], 10)).toBe(NO_LINE);
  });

  it('takes the later of two lines that start together', () => {
    const together = [
      { timeSec: 1, text: 'a' },
      { timeSec: 1, text: 'b' },
      { timeSec: 2, text: 'c' },
    ];
    expect(lyricLineAt(together, 1.5)).toBe(1);
  });

  it('agrees with a linear scan over a long song', () => {
    const many = Array.from({ length: 257 }, (_, i) => ({
      timeSec: i * 0.75,
      text: String(i),
    }));
    for (let t = -1; t < 200; t += 0.37) {
      const expected = many.findLastIndex((line) => line.timeSec <= t);
      expect(lyricLineAt(many, t)).toBe(expected);
    }
  });
});

describe('tap-along retiming', () => {
  const { lines } = songLyrics(stored(), null);

  it('skips lines with nothing to sing', () => {
    expect(nextSungLine(lines, 0)).toBe(0);
    expect(nextSungLine(lines, 1)).toBe(2);
    expect(nextSungLine(lines, 4)).toBe(NO_LINE);
  });

  it('stamps tapped lines and carries the last shift to the lines after', () => {
    const taps = [
      { line: 0, timeSec: 10.4 },
      { line: 2, timeSec: 14.9 },
    ];
    expect(retimedTimes(lines, taps)).toEqual([10.4, 12.4, 14.9, 18.9]);
  });

  it('keeps lines before the first tap where they were', () => {
    expect(retimedTimes(lines, [{ line: 2, timeSec: 13 }])).toEqual([
      10, 12, 13, 17,
    ]);
  });

  it('keeps every line in order around the taps', () => {
    expect(retimedTimes(lines, [{ line: 2, timeSec: 11 }])).toEqual([
      10, 11, 11, 15,
    ]);
    expect(
      retimedTimes(lines, [
        { line: 0, timeSec: 13.5 },
        { line: 2, timeSec: 14 },
      ]),
    ).toEqual([13.5, 14, 14, 18]);
  });

  it('leaves the timing alone without taps', () => {
    expect(retimedTimes(lines, [])).toEqual([10, 12, 14, 18]);
  });
});

describe('plain-only lyrics', () => {
  const PLAIN = stored({ synced: null, plain: 'a\n\n b  c \nd' });

  it('gives one untimed line per line of text, which the lookup never reaches', () => {
    const lyrics = songLyrics(PLAIN, null);
    expect(lyrics.lines.map((line) => line.text)).toEqual(['a', 'b c', 'd']);
    expect(lyrics.synced).toBe(false);
    expect(lyrics.retimed).toBe(false);
    expect(lyrics.plain).toBe('a\n\n b  c \nd');
    expect(lyricLineAt(lyrics.lines, 1000)).toBe(NO_LINE);
  });

  it('falls back to the plain text when the synced text has no timed line', () => {
    const lyrics = songLyrics(stored({ synced: 'x', plain: 'a' }), null);
    expect(lyrics.lines.map((line) => line.text)).toEqual(['a']);
  });

  it('does not count an empty retiming as retimed', () => {
    const lyrics = songLyrics(PLAIN, []);
    expect(lyrics.retimed).toBe(false);
    expect(lyrics.synced).toBe(false);
  });

  it('plays a saved retiming of the first lines and leaves the rest untimed', () => {
    const lyrics = songLyrics(PLAIN, [1, 2]);
    expect(lyrics.retimed).toBe(true);
    expect(lyrics.synced).toBe(true);
    expect(lyricLineAt(lyrics.lines, 1.5)).toBe(0);
    expect(lyricLineAt(lyrics.lines, 1000)).toBe(1);
  });

  it('refuses a saved retiming with more times than lines', () => {
    expect(songLyrics(PLAIN, [1, 2, 3, 4]).retimed).toBe(false);
  });

  it('never times a line after an untimed one', () => {
    const { lines } = songLyrics(PLAIN, [1]);
    expect(firstRetimeLine(lines, 0)).toBe(0);
    expect(firstRetimeLine(lines, 2)).toBe(1);
  });

  it('keeps untapped lines untimed through tap, shift and storage', () => {
    const { lines } = songLyrics(PLAIN, null);
    const tapped = retimedTimes(lines, [
      { line: 0, timeSec: 1 },
      { line: 1, timeSec: 2 },
    ]);
    expect(tapped).toEqual([1, 2, Infinity]);
    expect(shiftedTimes(tapped, 1)).toEqual([1.1, 2.1, Infinity]);
    expect(storedTimes(tapped)).toEqual([1, 2]);
  });
});

describe('a tap during retiming', () => {
  const { lines } = songLyrics(stored(), null);
  const take = {
    taps: [
      { line: 0, timeSec: 2 },
      { line: 2, timeSec: 5 },
    ],
    nextLine: 3,
  };

  it('takes the next line when it is later than every tap', () => {
    expect(takeAfterTap(lines, take, 8)).toEqual({
      taps: [...take.taps, { line: 3, timeSec: 8 }],
      nextLine: NO_LINE,
    });
  });

  it('redoes the take from the first tap it does not come after', () => {
    expect(takeAfterTap(lines, take, 4)).toEqual({
      taps: [
        { line: 0, timeSec: 2 },
        { line: 2, timeSec: 4 },
      ],
      nextLine: 3,
    });
    expect(takeAfterTap(lines, take, 1)).toEqual({
      taps: [{ line: 0, timeSec: 1 }],
      nextLine: 2,
    });
  });

  it('does not advance when the position has not moved', () => {
    expect(takeAfterTap(lines, take, 5)).toEqual(take);
  });

  it('is nothing past the last line, until the position goes back', () => {
    const done = { taps: take.taps, nextLine: NO_LINE };
    expect(takeAfterTap(lines, done, 9)).toBeNull();
    expect(takeAfterTap(lines, done, 4)?.nextLine).toBe(3);
  });
});

describe('shifting all lines', () => {
  it('moves every line by whole steps and stops at the song start', () => {
    const [first = 0, second = 0] = shiftedTimes([0.05, 3], -1);
    expect(first).toBe(0);
    expect(second).toBeCloseTo(2.9);
  });

  it('leaves the times alone at no steps', () => {
    expect(shiftedTimes([-0.25, 1], 0)).toEqual([-0.25, 1]);
  });
});
