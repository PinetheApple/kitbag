import type { LibrarySongRow, LibraryStemSetRow } from '@kitbag/core-state';
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

const STEMS: LibraryStemSetRow = {
  kind: 'stems',
  id: 1,
  title: 'Redbone',
  stemCount: 6,
  durationSec: 326,
  bpm: 81.4,
  key: 'F',
  scale: 'major',
  hasGrid: true,
  createdAt: new Date(0),
};

const BARE_STEMS: LibraryStemSetRow = {
  ...STEMS,
  bpm: null,
  key: null,
  scale: null,
  hasGrid: false,
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
    expect(rowSubtitle(STEMS)).toBe('5:26');
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

  it('badges a stem song like a song, plus its key and stem count', () => {
    const badges = stemBadges(STEMS);
    expect(badges.map((b) => [b.label, b.icon])).toEqual([
      ['81 BPM', undefined],
      ['F maj', undefined],
      ['GRID', 'check'],
      ['STEMS ×6', undefined],
    ]);
    expect(spokenRow(STEMS, badges, null)).toBe(
      'Redbone, stem song, 5 minutes 26 seconds, 81 beats per minute, key F major, Beat grid ready, 6 stems',
    );
  });

  it('names a StemDeck key once', () => {
    const badge = stemBadges({ ...STEMS, key: 'F maj', scale: 'Major' }).find(
      (b) => b.key === 'key',
    );
    expect([badge?.label, badge?.spoken]).toEqual(['F maj', 'key F major']);
  });

  it('leaves out the badges a stem song has no field for', () => {
    expect(stemBadges(BARE_STEMS).map((b) => [b.label, b.spoken])).toEqual([
      ['STEMS ×6', '6 stems'],
    ]);
    expect(
      stemBadges({ ...BARE_STEMS, key: 'C#', stemCount: 1 }).map(
        (b) => b.label,
      ),
    ).toEqual(['C#', 'STEMS ×1']);
    expect(stemBadges({ ...BARE_STEMS, stemCount: 1 })[0]?.spoken).toBe(
      '1 stem',
    );
  });
});
