import type { StoredLyrics } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import {
  lyricLineAt,
  NO_LINE,
  nextSungLine,
  retimedTimes,
  songLyrics,
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
    expect(lyrics.bundled).toEqual([9.5, 11.5, 13.5, 17.5]);
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

  it('has no synced lines for plain-only, instrumental or missing lyrics', () => {
    const plain = songLyrics(stored({ synced: null }), null);
    expect(plain.lines).toEqual([]);
    expect(plain.plain).toBe('One\nTwo\nThree');
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
