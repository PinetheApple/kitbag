import {
  sungLineFrom,
  formatClockSeconds,
  isSungLine,
  NO_LINE,
  NO_SECTION,
  sectionAt,
  type LyricLine,
} from '@kitbag/core-state';

import type { StemSection } from './sectionView.ts';

export type LyricRow =
  | { readonly kind: 'heading'; readonly key: string; readonly text: string }
  | {
      readonly kind: 'line';
      readonly key: string;
      readonly line: number;
      readonly text: string;
    };

export function lyricRows(
  lines: readonly LyricLine[],
  sections: readonly StemSection[],
): LyricRow[] {
  const rows: LyricRow[] = [];
  let headed = NO_SECTION;
  lines.forEach((lyric, line) => {
    if (!isSungLine(lyric)) return;
    const { timeSec, text } = lyric;
    const index = sectionAt(sections, timeSec);
    const section = sections[index];
    if (section !== undefined && index !== headed) {
      headed = index;
      rows.push({
        kind: 'heading',
        key: `h${String(index)}`,
        text: `${section.name} · ${formatClockSeconds(section.startSec)}`,
      });
    }
    rows.push({ kind: 'line', key: `l${String(line)}`, line, text });
  });
  return rows;
}

export function followedLine(
  lines: readonly LyricLine[],
  current: number,
): number {
  return current === NO_LINE ? NO_LINE : sungLineFrom(lines, current);
}
