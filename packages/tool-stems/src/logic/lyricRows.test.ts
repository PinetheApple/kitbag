import { describe, expect, it } from 'vitest';

import { detailPane, detailTabLabel, lyricRows } from './lyricRows.ts';

const section = (name: string, startSec: number, endSec: number) => ({
  name,
  kind: '',
  color: '',
  startSec,
  endSec,
});

const NO_LYRICS = {
  lines: [],
  bundledTimes: [],
  plain: null,
  instrumental: false,
  synced: false,
  retimed: false,
};

describe('lyricRows', () => {
  const sections = [section('Chorus', 46, 72), section('Verse 2', 72, 104)];

  it('puts a heading with its start time before a section’s first line', () => {
    expect(
      lyricRows(
        [
          { timeSec: 50, text: 'a' },
          { timeSec: 60, text: 'b' },
          { timeSec: 73, text: 'c' },
        ],
        sections,
      ),
    ).toEqual([
      { kind: 'heading', key: 'h0', text: 'Chorus · 0:46' },
      { kind: 'line', key: 'l0', line: 0, text: 'a' },
      { kind: 'line', key: 'l1', line: 1, text: 'b' },
      { kind: 'heading', key: 'h1', text: 'Verse 2 · 1:12' },
      { kind: 'line', key: 'l2', line: 2, text: 'c' },
    ]);
  });

  it('keeps the line index across a blank line, which draws no row', () => {
    expect(
      lyricRows(
        [
          { timeSec: 1, text: 'a' },
          { timeSec: 2, text: '' },
          { timeSec: 3, text: 'b' },
        ],
        [],
      ),
    ).toEqual([
      { kind: 'line', key: 'l0', line: 0, text: 'a' },
      { kind: 'line', key: 'l2', line: 2, text: 'b' },
    ]);
  });

  it('draws no heading for a line outside every section', () => {
    expect(lyricRows([{ timeSec: 1, text: 'a' }], sections)).toEqual([
      { kind: 'line', key: 'l0', line: 0, text: 'a' },
    ]);
  });

  it('draws a section heading once when a line in a gap splits it', () => {
    const rows = lyricRows(
      [
        { timeSec: 50, text: 'a' },
        { timeSec: 50.5, text: 'b' },
      ],
      sections,
    );
    expect(rows.filter((row) => row.kind === 'heading')).toHaveLength(1);
  });
});

describe('detailTabLabel', () => {
  const lines = [{ timeSec: 1, text: 'a' }];
  const cards = [section('A', 0, 1)];

  it('is Lyrics while the song has lines', () => {
    expect(detailTabLabel(cards, { ...NO_LYRICS, lines })).toBe('Lyrics');
    expect(detailTabLabel([], { ...NO_LYRICS, lines })).toBe('Lyrics');
  });

  it('becomes Sections for an instrumental or a song with no lines', () => {
    expect(detailTabLabel(cards, { ...NO_LYRICS, instrumental: true })).toBe(
      'Sections',
    );
    expect(detailTabLabel(cards, NO_LYRICS)).toBe('Sections');
  });

  it('is absent when there is nothing to show', () => {
    expect(detailTabLabel([], NO_LYRICS)).toBeNull();
  });
});

describe('detailPane', () => {
  const lines = [{ timeSec: 1, text: 'a' }];

  it('picks stage lines for a song with times', () => {
    expect(detailPane({ ...NO_LYRICS, lines, synced: true })).toBe('stage');
  });

  it('picks plain text when no line has a time', () => {
    expect(
      detailPane({
        ...NO_LYRICS,
        lines: [{ timeSec: Infinity, text: 'a' }],
        plain: 'a',
      }),
    ).toBe('plain');
  });

  it('says so only for a song marked instrumental', () => {
    expect(detailPane({ ...NO_LYRICS, instrumental: true })).toBe(
      'instrumental',
    );
    expect(detailPane(NO_LYRICS)).toBe('none');
  });
});
