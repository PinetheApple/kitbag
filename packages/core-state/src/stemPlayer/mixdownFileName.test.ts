import { describe, expect, it } from 'vitest';

import {
  MAX_BASE_NAME_BYTES,
  mixdownFileName,
  type MixdownNameParts,
} from './mixdownFileName.ts';

const PLAIN: MixdownNameParts = {
  title: 'Echo (In Jesus Name) [LIVE]',
  artist: 'Charity Gayle',
  speed: 1,
  key: 0,
};

const EXTENSION = '.wav';

function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

function baseOf(name: string): string {
  return name.slice(0, -EXTENSION.length);
}

describe('mixdownFileName', () => {
  it('names the song and artist', () => {
    expect(mixdownFileName(PLAIN)).toBe(
      'Echo (In Jesus Name) [LIVE] - Charity Gayle.wav',
    );
  });

  it('leaves the artist out when there is none', () => {
    expect(mixdownFileName({ ...PLAIN, artist: null })).toBe(
      'Echo (In Jesus Name) [LIVE].wav',
    );
    expect(mixdownFileName({ ...PLAIN, artist: ' :/ ' })).toBe(
      'Echo (In Jesus Name) [LIVE].wav',
    );
  });

  it('adds speed and key only when they are changed', () => {
    expect(mixdownFileName({ ...PLAIN, speed: 0.75, key: -2 })).toBe(
      'Echo (In Jesus Name) [LIVE] - Charity Gayle (0.75x, -2 st).wav',
    );
    expect(mixdownFileName({ ...PLAIN, speed: 0.8 })).toBe(
      'Echo (In Jesus Name) [LIVE] - Charity Gayle (0.8x).wav',
    );
    expect(mixdownFileName({ ...PLAIN, key: 3 })).toBe(
      'Echo (In Jesus Name) [LIVE] - Charity Gayle (+3 st).wav',
    );
  });

  it('states no key when the stems are keyed differently', () => {
    expect(mixdownFileName({ ...PLAIN, speed: 1.25, key: null })).toBe(
      'Echo (In Jesus Name) [LIVE] - Charity Gayle (1.25x).wav',
    );
  });

  it('strips characters that are unsafe in a file name', () => {
    expect(
      mixdownFileName({
        title: 'AC/DC: "Back\\in*Black"?',
        artist: '<Live>|\u0007',
        speed: 1,
        key: 0,
      }),
    ).toBe('ACDC BackinBlack - Live.wav');
  });

  it('never starts with a dot or a space, and falls back when nothing is left', () => {
    expect(mixdownFileName({ ...PLAIN, title: '  ..hidden  ' })).toBe(
      'hidden - Charity Gayle.wav',
    );
    expect(mixdownFileName({ ...PLAIN, title: '/:*', artist: null })).toBe(
      'Mix.wav',
    );
  });

  it('collapses runs of whitespace', () => {
    expect(
      mixdownFileName({ ...PLAIN, title: 'A \t\n  B', artist: null }),
    ).toBe('A B.wav');
  });

  it('caps a long title by UTF-8 bytes and keeps the speed and key', () => {
    const name = mixdownFileName({
      ...PLAIN,
      title: 'x'.repeat(400),
      speed: 0.75,
      key: -2,
    });
    expect(utf8Length(baseOf(name))).toBe(MAX_BASE_NAME_BYTES);
    expect(name.endsWith(' (0.75x, -2 st).wav')).toBe(true);
  });

  it('keeps a long CJK title whole up to the byte cap, cut between characters', () => {
    const title = '夜'.repeat(200);
    const name = mixdownFileName({ ...PLAIN, title, artist: null });
    const base = baseOf(name);
    expect(utf8Length(base)).toBeLessThanOrEqual(MAX_BASE_NAME_BYTES);
    expect(utf8Length(base)).toBeGreaterThan(MAX_BASE_NAME_BYTES - 3);
    expect(base).toMatch(/^夜+$/u);
  });

  it('drops an emoji that would straddle the cap rather than split it', () => {
    const filler = 'a'.repeat(MAX_BASE_NAME_BYTES - 2);
    const name = mixdownFileName({
      ...PLAIN,
      title: `${filler}🎸`,
      artist: null,
    });
    expect(baseOf(name)).toBe(filler);
    expect(name).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/u);
  });

  it('keeps an emoji that fits exactly', () => {
    const filler = 'a'.repeat(MAX_BASE_NAME_BYTES - 4);
    const name = mixdownFileName({
      ...PLAIN,
      title: `${filler}🎸`,
      artist: null,
    });
    expect(baseOf(name)).toBe(`${filler}🎸`);
  });
});
