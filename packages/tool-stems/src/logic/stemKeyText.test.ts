import { describe, expect, it } from 'vitest';

import { perStemSummary, spokenKey } from './stemKeyText.ts';

const vocals = { name: 'vocals', transposable: true, key: -2 };
const drums = { name: 'drums', transposable: false, key: 0 };
const bass = { name: 'bass', transposable: true, key: 0 };

describe('stem key text', () => {
  it('speaks the key in semitones', () => {
    expect([spokenKey(-2), spokenKey(1), spokenKey(0)]).toEqual([
      'down 2 semitones',
      'up 1 semitone',
      'as recorded',
    ]);
  });

  it('names the stems set apart from the song key', () => {
    expect(perStemSummary([vocals, drums], -2)).toBe('all follow the song');
    expect(perStemSummary([vocals, drums, bass], -2)).toBe('bass set apart');
    expect(perStemSummary([vocals, drums, bass], 3)).toBe('2 stems set apart');
  });
});
