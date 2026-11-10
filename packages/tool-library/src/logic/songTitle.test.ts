import { describe, expect, it } from 'vitest';

import { songTitle } from './songTitle.ts';

describe('songTitle', () => {
  it('keeps a song title', () => {
    expect(songTitle('Everlong')).toBe('Everlong');
  });

  it('names a song whose title has not loaded yet', () => {
    expect(songTitle('')).toBe('Song');
  });
});
