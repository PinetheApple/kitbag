import { describe, expect, it } from 'vitest';

import { replaceKeepsText } from './replaceText.ts';

describe('what a replace keeps', () => {
  it('keeps the mix and key only when the copy brings none', () => {
    expect(replaceKeepsText('job', 1)).toContain(
      'its mix and key unless this copy brings its own',
    );
  });

  it('keeps bar one and the lyric timing for the same StemDeck job', () => {
    const text = replaceKeepsText('job', 1);
    expect(text).toContain('Bar one is kept');
    expect(text).toContain('lyric timing while the lyrics are unchanged');
  });

  it('starts bar one and the lyric timing over for a song separated again', () => {
    expect(replaceKeepsText('song', 1)).toContain(
      'Bar one and your lyric timing start over',
    );
  });

  it('speaks of several songs in the plural', () => {
    const text = replaceKeepsText('song', 2);
    expect(text).toContain('Replacing them removes their stems');
    expect(text).toContain('unless these copies bring their own');
    expect(text.endsWith('This cannot be undone.')).toBe(true);
  });
});
