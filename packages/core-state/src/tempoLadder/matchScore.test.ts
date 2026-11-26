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
