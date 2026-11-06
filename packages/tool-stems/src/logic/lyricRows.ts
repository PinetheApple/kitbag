import {
  formatClockSeconds,
  NO_SECTION,
  sectionAt,
  type LyricLine,
  type SongLyrics,
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

export type DetailPane = 'stage' | 'plain' | 'instrumental' | 'none';

export function lyricRows(
  lines: readonly LyricLine[],
  sections: readonly StemSection[],
): LyricRow[] {
  const rows: LyricRow[] = [];
  let headed = NO_SECTION;
  lines.forEach(({ timeSec, text }, line) => {
    if (text === '') return;
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

export function detailTabLabel(
  sections: readonly unknown[],
  lyrics: SongLyrics,
): string | null {
  if (lyrics.lines.length > 0) return 'Lyrics';
  return sections.length > 0 || lyrics.instrumental ? 'Sections' : null;
}

export function detailPane(lyrics: SongLyrics): DetailPane {
  if (lyrics.lines.length > 0) return lyrics.synced ? 'stage' : 'plain';
  return lyrics.instrumental ? 'instrumental' : 'none';
}
