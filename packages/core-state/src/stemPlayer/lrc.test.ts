import { describe, expect, it } from 'vitest';

import { parseLrc, plainLyricTexts } from './lrc.ts';

describe('LRC parsing', () => {
  it('reads hundredths and milliseconds', () => {
    expect(parseLrc('[00:12.25]First\n[01:05.125]Second')).toEqual([
      { timeSec: 12.25, text: 'First' },
      { timeSec: 65.125, text: 'Second' },
    ]);
  });

  it('reads whole seconds and a colon before the fraction', () => {
    expect(parseLrc('[00:03]One\n[00:04:50]Two')).toEqual([
      { timeSec: 3, text: 'One' },
      { timeSec: 4.5, text: 'Two' },
    ]);
  });

  it('gives a line with several time tags one entry per tag, sorted', () => {
    expect(parseLrc('[00:30.00][00:10.00]Chorus\n[00:20.00]Verse')).toEqual([
      { timeSec: 10, text: 'Chorus' },
      { timeSec: 20, text: 'Verse' },
      { timeSec: 30, text: 'Chorus' },
    ]);
  });

  it('skips metadata tags, untimed text and blank lines', () => {
    const text = [
      '[ar:Someone]',
      '[ti:Song]',
      '[length:03:20]',
      '',
      'no tag here',
      '[00:01.00]Sung',
      '   ',
    ].join('\r\n');
    expect(parseLrc(text)).toEqual([{ timeSec: 1, text: 'Sung' }]);
  });

  it('keeps a timed empty line, which clears the lyric', () => {
    expect(parseLrc('[00:01.00]Sung\n[00:04.00]\n[00:06.00] Again ')).toEqual([
      { timeSec: 1, text: 'Sung' },
      { timeSec: 4, text: '' },
      { timeSec: 6, text: 'Again' },
    ]);
  });

  it('drops word stamps from the text', () => {
    expect(parseLrc('[00:01.00]<00:01.00>You <00:01.40>moved')).toEqual([
      { timeSec: 1, text: 'You moved' },
    ]);
  });

  it('shows lines earlier by a positive offset tag, wherever it sits', () => {
    expect(parseLrc('[00:10.00]A\n[offset:+500]\n[00:20.00]B')).toEqual([
      { timeSec: 9.5, text: 'A' },
      { timeSec: 19.5, text: 'B' },
    ]);
    expect(parseLrc('[offset:-250]\n[00:10.00]A')).toEqual([
      { timeSec: 10.25, text: 'A' },
    ]);
  });

  it('never moves a line before the start of the song', () => {
    expect(parseLrc('[offset:2000]\n[00:01.00]A')).toEqual([
      { timeSec: 0, text: 'A' },
    ]);
  });

  it('splits on a bare carriage return', () => {
    expect(parseLrc('[00:01.00]A\r[00:02.00]B')).toEqual([
      { timeSec: 1, text: 'A' },
      { timeSec: 2, text: 'B' },
    ]);
  });

  it('normalises text to composed form', () => {
    const [line] = parseLrc('[00:01.00]Cafe\u0301');
    expect(line?.text).toBe('Caf\u00e9');
  });

  it('gives nothing for plain text', () => {
    expect(parseLrc('First line\nSecond line')).toEqual([]);
    expect(parseLrc('')).toEqual([]);
  });
});

describe('plain lyric text', () => {
  it('splits every line ending, normalises and drops blank lines', () => {
    expect(plainLyricTexts('a\rb\r\n\n Cafe\u0301 \nd')).toEqual([
      'a',
      'b',
      'Caf\u00e9',
      'd',
    ]);
  });
});
