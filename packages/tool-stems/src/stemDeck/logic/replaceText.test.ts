import { replaceKeepsText } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import { replaceHint, replaceSheetTitle } from './replaceText.ts';

describe('the StemDeck replace sheet', () => {
  it('names one song in the title, or counts several', () => {
    expect(replaceSheetTitle(['Gratitude'])).toBe('Replace “Gratitude”?');
    expect(replaceSheetTitle(['Gratitude', 'Way Maker'])).toBe(
      'Replace 2 songs?',
    );
  });

  it('says a song with the same job is already in the library', () => {
    const hint = replaceHint(['Gratitude'], 'job');
    expect(hint).toContain('“Gratitude” is already in your library.');
    expect(hint).not.toContain('Keep both');
  });

  it('says a matched song was separated again and can be kept as a second song', () => {
    const hint = replaceHint(['Gratitude', 'Way Maker'], 'song');
    expect(hint).toContain('Gratitude, Way Maker look like songs');
    expect(hint).toContain('Keep both to add them as second songs');
  });

  it('ends with what the replace keeps, for the match kind and count', () => {
    expect(replaceHint(['Gratitude', 'Way Maker'], 'song')).toContain(
      replaceKeepsText('song', 2),
    );
  });
});
