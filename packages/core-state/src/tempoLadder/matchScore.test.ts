import { describe, expect, it } from 'vitest';

import { MATCH_THRESHOLD, rankMatches, songMatchScore } from './matchScore.ts';

const QUERY = { title: 'Under Pressure', artist: 'Queen' };

describe('songMatchScore', () => {
  it('accepts the same song written differently', () => {
    expect(
      songMatchScore(QUERY, {
        title: 'Under Pressure - Remastered 2011',
        artist: 'QUEEN',
      }),
    ).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
  });

  it('rejects a different song by the same artist', () => {
    expect(
      songMatchScore(
        { title: 'Love', artist: 'Queen' },
        { title: 'Love Story', artist: 'Queen' },
      ),
    ).toBeLessThan(MATCH_THRESHOLD);
  });

  it('rejects the same title by another artist', () => {
    expect(
      songMatchScore(QUERY, {
        title: 'Under Pressure',
        artist: 'Karaoke Band',
      }),
    ).toBeLessThan(MATCH_THRESHOLD);
  });

  it('accepts a shared credit that names one of the artists', () => {
    expect(
      songMatchScore(
        { title: 'Under Pressure', artist: 'Queen & David Bowie' },
        QUERY,
      ),
    ).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
  });

  it('cannot match an unknown artist', () => {
    expect(songMatchScore({ title: 'Under Pressure', artist: '' }, QUERY)).toBe(
      0,
    );
  });
});

describe('songMatchScore across releases', () => {
  const accepts = (a: string, b: string, artist = 'Pink Floyd') =>
    songMatchScore({ title: a, artist }, { title: b, artist }) >=
    MATCH_THRESHOLD;

  it('rejects another part of the same song', () => {
    expect(
      accepts(
        'Another Brick in the Wall (Part 1)',
        'Another Brick in the Wall (Part 2)',
      ),
    ).toBe(false);
    expect(
      accepts(
        'Another Brick in the Wall, Pt. 1',
        'Another Brick in the Wall, Pt. 2',
      ),
    ).toBe(false);
  });

  it('accepts the same part written differently', () => {
    expect(
      accepts(
        'Another Brick in the Wall, Pt. 2',
        'Another Brick in the Wall (Part II)',
      ),
    ).toBe(true);
  });

  it('rejects a remix or a mix of the song', () => {
    expect(accepts('Levels', 'Levels (Skrillex Remix)', 'Avicii')).toBe(false);
    expect(accepts('Song 2', 'Song 2 - Club Mix', 'Blur')).toBe(false);
  });

  it('accepts a remaster or a featured artist', () => {
    expect(accepts('Song 2', 'Song 2 (Remastered 2011)', 'Blur')).toBe(true);
    expect(accepts('Song 2', 'Song 2 feat. Someone', 'Blur')).toBe(true);
  });

  it('ranks an artist written with The as the same artist', () => {
    const credited = { title: 'Help', artist: 'Beatles, Someone Else' };
    const withThe = { title: 'Help', artist: 'The Beatles' };
    expect(
      rankMatches({ title: 'Help', artist: 'Beatles' }, [credited, withThe]),
    ).toEqual([withThe, credited]);
  });

  it('accepts an artist written with or without The', () => {
    expect(
      songMatchScore(
        { title: 'Help!', artist: 'The Beatles' },
        { title: 'Help', artist: 'Beatles' },
      ),
    ).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
  });
});

describe('rankMatches', () => {
  it('keeps only matches, best first', () => {
    const exact = { title: 'Under Pressure', artist: 'Queen' };
    const credited = { title: 'Under Pressure', artist: 'Queen, Extra Credit' };
    const wrong = { title: 'Radio Ga Ga', artist: 'Queen' };
    expect(rankMatches(QUERY, [wrong, credited, exact])).toEqual([
      exact,
      credited,
    ]);
  });
});
