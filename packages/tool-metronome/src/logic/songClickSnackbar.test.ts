import { describe, expect, it } from 'vitest';

import { songClickOffMessage } from './songClickSnackbar.ts';

describe('songClickOffMessage', () => {
  it('names the song that keeps playing', () => {
    expect(songClickOffMessage('Everlong')).toBe(
      'Song click off. Everlong keeps playing.',
    );
  });
});
