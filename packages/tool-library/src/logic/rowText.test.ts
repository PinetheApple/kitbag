import type {
  LibraryRow,
  LibrarySongRow,
  LibraryStemSetRow,
  SongBadge,
} from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  formatLength,
  rowBadges,
  rowSubtitle,
  spokenLength,
  spokenRow,
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

const labels = (row: LibraryRow, status: SongBadge) =>
  rowBadges(row, status).map((badge) => [badge.label, badge.icon, badge.tone]);

describe('row facts line', () => {
  it('reads length · BPM for a song and length · BPM · key for a stem song', () => {
    expect(rowSubtitle(SONG, 'grid', null)).toBe('4:10 · 158 BPM');
    expect(rowSubtitle(STEMS, 'grid', null)).toBe('5:26 · 81 BPM · F maj');
  });

  it('leaves out the artist, which stays in search and speech', () => {
    expect(rowSubtitle(SONG, 'grid', null)).not.toContain('Foo Fighters');
    expect(spokenRow(SONG, 'grid', null)).toContain('Foo Fighters');
  });

  it('says analyzing or no beat grid instead of facts there are none of yet', () => {
    expect(rowSubtitle(SONG, 'analyzing', null)).toBe('4:10 · analyzing…');
    expect(rowSubtitle({ ...SONG, bpm: null }, 'failed', null)).toBe(
      '4:10 · no beat grid',
    );
  });

  it('keeps the BPM and grid of a song whose re-analysis failed, and says so', () => {
    const kept: LibrarySongRow = { ...SONG, analysisStatus: 'failed' };
    const failure = { kind: 'other', keptGrid: true } as const;
    expect(rowSubtitle(kept, 'grid', failure)).toBe(
      '4:10 · 158 BPM · re-analysis failed',
    );
    expect(labels(kept, 'grid')).toEqual([['GRID', 'check', 'success']]);
    expect(rowSubtitle(SONG, 'grid', null)).not.toContain('failed');
  });

  it('drops what is unknown', () => {
    expect(
      rowSubtitle({ ...SONG, durationSec: 0, bpm: null }, 'pending', null),
    ).toBe('');
    expect(rowSubtitle(BARE_STEMS, 'noGrid', null)).toBe('5:26');
  });

  it('names a StemDeck key once', () => {
    expect(
      rowSubtitle({ ...STEMS, key: 'F maj', scale: 'Major' }, 'grid', null),
    ).toBe('5:26 · 81 BPM · F maj');
  });
});

describe('row badges', () => {
  it.each([
    ['grid', [['GRID', 'check', 'success']]],
    ['analyzing', [['ANALYZING', 'analyzing', 'warning']]],
    ['failed', [['FAILED', 'error', 'danger']]],
    ['pending', [['NOT ANALYZED', undefined, 'default']]],
    ['noGrid', [['NO GRID', undefined, 'default']]],
  ] as const)('a %s song shows only its status', (status, expected) => {
    expect(labels(SONG, status)).toEqual(expected);
  });

  it('puts the stem count above the grid on a stem song', () => {
    expect(labels(STEMS, 'grid')).toEqual([
      ['STEMS ×6', undefined, 'accent'],
      ['GRID', 'check', 'success'],
    ]);
    expect(labels(BARE_STEMS, 'noGrid')).toEqual([
      ['STEMS ×6', undefined, 'accent'],
    ]);
  });
});

describe('spoken row', () => {
  it('speaks the facts and badges of a song', () => {
    expect(spokenRow(SONG, 'grid', null)).toBe(
      'Everlong, Foo Fighters, 4 minutes 10 seconds, 158 beats per minute, Beat grid ready',
    );
  });

  it('speaks a stem song with its key and stem count', () => {
    expect(spokenRow(STEMS, 'grid', null)).toBe(
      'Redbone, 5 minutes 26 seconds, 81 beats per minute, key F major, 6 stems, Beat grid ready',
    );
  });

  it('speaks why analysis failed, and no BPM while analyzing', () => {
    expect(spokenRow({ ...SONG, bpm: null }, 'failed', 'Missing file')).toBe(
      'Everlong, Foo Fighters, 4 minutes 10 seconds, Analysis failed, Missing file',
    );
    expect(spokenRow(SONG, 'analyzing', null)).not.toContain(
      'beats per minute',
    );
  });
});
