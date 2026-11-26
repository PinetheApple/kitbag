import { describe, expect, it } from 'vitest';

import { artistCredits, songMatchKey, songMatchText } from './song-match-key';

describe('songMatchText', () => {
  it('folds case and diacritics', () => {
    expect(songMatchText('Beyoncé')).toBe('beyonce');
    expect(songMatchText('MOTÖRHEAD')).toBe('motorhead');
  });

  it('drops a featured artist', () => {
    expect(songMatchText('Lose Yourself feat. Someone')).toBe('lose yourself');
    expect(songMatchText('Lose Yourself ft Someone')).toBe('lose yourself');
    expect(songMatchText('Lose Yourself (featuring Someone)')).toBe(
      'lose yourself',
    );
  });

  it('drops bracketed release notes', () => {
    expect(songMatchText('Let It Be (Remastered 2009)')).toBe('let it be');
    expect(songMatchText('Let It Be [Live]')).toBe('let it be');
  });

  it('drops a dashed release note but keeps a dashed title', () => {
    expect(songMatchText('Let It Be - Remastered 2009')).toBe('let it be');
    expect(songMatchText('Let It Be – Live at Wembley')).toBe('let it be');
    expect(songMatchText('Hey - You')).toBe('hey you');
  });

  it('keeps a title that is only brackets', () => {
    expect(songMatchText('(Untitled)')).toBe('untitled');
  });

  it('ignores punctuation and spacing', () => {
    expect(songMatchText("  Don't   Stop Me Now! ")).toBe('dont stop me now');
    expect(songMatchText('Don’t Stop Me Now')).toBe('dont stop me now');
  });

  it('reads an ampersand as and', () => {
    expect(songMatchText('Simon & Garfunkel')).toBe('simon and garfunkel');
  });

  it('treats LIKE wildcards as ordinary text', () => {
    expect(songMatchText('100%_Pure')).toBe('100 pure');
  });
});

describe('artistCredits', () => {
  it('splits a shared credit into each artist', () => {
    expect(artistCredits('Queen & David Bowie')).toEqual([
      'queen',
      'david bowie',
    ]);
    expect(artistCredits('A, B; C / D feat. E')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('has no credits for an unknown artist', () => {
    expect(artistCredits('  ')).toEqual([]);
  });
});

describe('songMatchKey', () => {
  it('gives the same key to the same song written differently', () => {
    expect(
      songMatchKey({ title: 'Under Pressure (Remastered)', artist: 'QUEEN' }),
    ).toEqual(songMatchKey({ title: 'under pressure', artist: 'Queen' }));
  });
});
