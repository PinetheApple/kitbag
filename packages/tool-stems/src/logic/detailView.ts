import type { SongLyrics } from '@kitbag/core-state';

export type DetailPaneKind = 'stage' | 'plain' | 'instrumental' | 'none';

export function detailTabLabel(
  hasSections: boolean,
  lyrics: SongLyrics,
): string | null {
  if (lyrics.lines.length > 0) return 'Lyrics';
  return hasSections || lyrics.instrumental ? 'Sections' : null;
}

export function detailPaneKind(lyrics: SongLyrics): DetailPaneKind {
  if (lyrics.lines.length > 0) return lyrics.synced ? 'stage' : 'plain';
  return lyrics.instrumental ? 'instrumental' : 'none';
}
