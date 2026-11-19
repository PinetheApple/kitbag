import type { StemDeckSong } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  importLabel,
  lastUsedText,
  recentSubtitle,
  songFacts,
  unavailableText,
} from './songFacts.ts';

const SONG: StemDeckSong = {
  jobId: 'a',
  title: 'Way Maker',
  artist: 'Sinach',
  durationSec: 481,
  lanes: ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other'],
  inLibrary: false,
};

const DAY_MS = 86_400_000;
const NOW = Date.UTC(2026, 10, 19, 12);

describe('a song on StemDeck', () => {
  it('lists artist, length and stem count', () => {
    expect(songFacts(SONG)).toBe('Sinach · 8:01 · 6 stems');
  });

  it('leaves out what StemDeck did not say', () => {
    expect(
      songFacts({ ...SONG, artist: null, durationSec: null, lanes: ['bass'] }),
    ).toBe('1 stem');
  });
});

describe('songs that are not listed', () => {
  it('counts them in one line', () => {
    expect(unavailableText(2)).toBe(
      '2 more songs on StemDeck aren’t listed because their stems are missing on the computer.',
    );
    expect(unavailableText(1)).toBe(
      '1 more song on StemDeck isn’t listed because its stems are missing on the computer.',
    );
  });
});

describe('the import button', () => {
  it('counts the picked songs', () => {
    expect(importLabel(3)).toBe('Import 3 songs');
    expect(importLabel(1)).toBe('Import 1 song');
    expect(importLabel(0)).toBe('Import songs');
  });
});

describe('a recent server', () => {
  it('says how it is trusted and when it was used', () => {
    expect(recentSubtitle('pinned', NOW - DAY_MS, NOW, 'en-GB')).toBe(
      'Trusted · last used yesterday',
    );
    expect(
      recentSubtitle('plain', Date.UTC(2026, 10, 3, 12), NOW, 'en-GB'),
    ).toBe('Not encrypted · last used 3 Nov');
  });

  it('says today for a server used today', () => {
    expect(lastUsedText(NOW, NOW, 'en-GB')).toBe('today');
  });
});
