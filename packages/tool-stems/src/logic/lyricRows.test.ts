import { describe, expect, it } from 'vitest';

import { lyricRows } from './lyricRows.ts';

const section = (name: string, startSec: number, endSec: number) => ({
  name,
  kind: '',
  color: '',
  startSec,
  endSec,
});

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
