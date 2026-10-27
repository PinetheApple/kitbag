import type { LibrarySongRow } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  formatLength,
  rowSubtitle,
  songBadges,
  spokenLength,
  spokenRow,
  stemBadges,
} from './rowText.ts';

const SONG: LibrarySongRow = {
  kind: 'song',
  id: 1,
  title: 'Everlong',
  artist: 'Foo Fighters',
  durationSec: 250.4,
  bpm: 158.2,
  hasGrid: true,
  analysisStatus: 'done',
  analysisError: null,
  inSetlist: false,
  createdAt: new Date(0),
};

describe('length', () => {
  it.each([
    [0, '0:00', '0 seconds'],
    [59.6, '1:00', '1 minute 0 seconds'],
    [250.4, '4:10', '4 minutes 10 seconds'],
    [3725, '1:02:05', '1 hour 2 minutes 5 seconds'],
  ])('%s s reads %s and says %s', (seconds, shown, spoken) => {
    expect(formatLength(seconds)).toBe(shown);
    expect(spokenLength(seconds)).toBe(spoken);
  });
});

describe('row text', () => {
  it('shows artist and length, dropping what is unknown', () => {
    expect(rowSubtitle(SONG)).toBe('Foo Fighters · 4:10');
    expect(rowSubtitle({ ...SONG, artist: '', durationSec: 0 })).toBe(
      undefined,
    );
    expect(
      rowSubtitle({
        kind: 'stems',
        id: 1,
        title: 'Redbone',
        stemCount: 6,
        durationSec: 326,
        createdAt: new Date(0),
      }),
    ).toBe('5:26');
  });

  it('badges BPM and grid status, and speaks them', () => {
    const badges = songBadges(SONG, 'grid');
    expect(badges.map((b) => [b.label, b.icon])).toEqual([
      ['158 BPM', undefined],
      ['GRID', 'check'],
    ]);
    expect(spokenRow(SONG, badges, null)).toBe(
      'Everlong, Foo Fighters, 4 minutes 10 seconds, 158 beats per minute, Beat grid ready',
    );
  });

  it('shows no BPM while analyzing and no status badge on failure', () => {
    const pending = { ...SONG, bpm: null };
    expect(songBadges(pending, 'analyzing').map((b) => b.label)).toEqual([
      'ANALYZING…',
    ]);
    expect(songBadges(pending, 'failed')).toEqual([]);
    expect(spokenRow(pending, [], 'Missing file')).toMatch(/, Missing file$/);
  });

  it('counts stems', () => {
    expect(stemBadges(6).map((b) => [b.label, b.spoken])).toEqual([
      ['STEMS ×6', '6 stems'],
    ]);
    expect(stemBadges(1)[0]?.spoken).toBe('1 stem');
  });
});
