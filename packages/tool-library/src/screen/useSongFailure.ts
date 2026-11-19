import {
  analysisFailure,
  useSongLibrary,
  type AnalysisFailure,
} from '@kitbag/core-state';

export function useSongFailure(songId: number): AnalysisFailure | null {
  const song = useSongLibrary((s) =>
    s.rows.find((row) => row.kind === 'song' && row.id === songId),
  );
  const codes = useSongLibrary((s) => s.codes);
  return song?.kind === 'song' ? analysisFailure(song, codes) : null;
}
