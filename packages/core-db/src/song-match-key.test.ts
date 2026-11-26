import { describe, expect, it } from 'vitest';

import {
  artistCredits,
  artistMatchText,
  songMatchKey,
  songMatchText,
} from './song-match-key';

describe('songMatchText', () => {
  it('folds case and diacritics', () => {
    expect(songMatchText('Beyoncé')).toBe('beyonce');
    expect(songMatchText('MOTÖRHEAD')).toBe('motorhead');
  });

  it('folds letters that carry no separate accent', () => {
    expect(songMatchText('Røyksopp')).toBe('royksopp');
    expect(songMatchText('Ænima')).toBe('aenima');
    expect(songMatchText('Straße')).toBe('strasse');
    expect(songMatchText('Łódź')).toBe('lodz');
    expect(songMatchText('Đorđe')).toBe('dorde');
    expect(songMatchText('Cœur')).toBe('coeur');
  });

  it('drops a featured artist', () => {
    expect(songMatchText('Lose Yourself feat. Someone')).toBe('lose yourself');
    expect(songMatchText('Lose Yourself ft Someone')).toBe('lose yourself');
    expect(songMatchText('Lose Yourself (featuring Someone)')).toBe(
      'lose yourself',
    );
    expect(songMatchText('Lose Yourself (feat. Someone) [Live]')).toBe(
      'lose yourself live',
    );
  });

  it('drops a release note that leaves the tempo alone', () => {
    expect(songMatchText('Let It Be (Remastered 2009)')).toBe('let it be');
    expect(songMatchText('Let It Be - 2009 Remaster')).toBe('let it be');
    expect(songMatchText('Let It Be [Digitally Remastered]')).toBe('let it be');
    expect(songMatchText('Let It Be (Mono)')).toBe('let it be');
    expect(songMatchText('Let It Be - Single Version')).toBe('let it be');
    expect(songMatchText('Let It Be – Radio Edit')).toBe('let it be');
  });

  it('keeps a note that can change the tempo, bracketed or dashed', () => {
    expect(songMatchText('Let It Be [Live]')).toBe('let it be live');
    expect(songMatchText('Let It Be – Live at Wembley')).toBe(
      'let it be live at wembley',
    );
    expect(songMatchText('Levels (Skrillex Remix)')).toBe(
      'levels skrillex remix',
    );
    expect(songMatchText('Song 2 - Club Mix')).toBe('song 2 club mix');
    expect(songMatchText('Hurt (Acoustic Version)')).toBe(
      'hurt acoustic version',
    );
    expect(songMatchText('Hey - You')).toBe('hey you');
    expect(songMatchText('Hurt (Version)')).toBe('hurt version');
  });

  it('writes every part number the same way', () => {
    expect(songMatchText('Another Brick in the Wall, Pt. 2')).toBe(
      'another brick in the wall part 2',
    );
    expect(songMatchText('Another Brick in the Wall (Part II)')).toBe(
      'another brick in the wall part 2',
    );
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

describe('artistMatchText', () => {
  it('drops a leading The', () => {
    expect(artistMatchText('The Beatles')).toBe('beatles');
    expect(artistMatchText('Beatles')).toBe('beatles');
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

  it('drops a leading The from each credit', () => {
    expect(artistCredits('The Beatles & The Who')).toEqual(['beatles', 'who']);
  });

  it('has no credits for an unknown artist', () => {
    expect(artistCredits('  ')).toEqual([]);
  });
});

describe('songMatchKey', () => {
  it('gives the same key to the same song written differently', () => {
    expect(
      songMatchKey({
        title: 'Under Pressure (Remastered 2011)',
        artist: 'THE QUEEN',
      }),
    ).toEqual(songMatchKey({ title: 'under pressure', artist: 'Queen' }));
  });

  it('keeps a remix apart from the original', () => {
    expect(
      songMatchKey({ title: 'Levels (Skrillex Remix)', artist: 'Avicii' }),
    ).not.toEqual(songMatchKey({ title: 'Levels', artist: 'Avicii' }));
  });
});
