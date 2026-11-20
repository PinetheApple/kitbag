import {
  analysisFailure,
  rowFilesOf,
  useSongLibrary,
  type AnalysisFailure,
  type LibraryRow,
  type RowFiles,
} from '@kitbag/core-state';

export function useRowFiles(row: LibraryRow | null): RowFiles | null {
  return useSongLibrary((s) =>
    row === null ? null : rowFilesOf(s.rowFiles, row),
  );
}

export function useRowFailure(row: LibraryRow | null): AnalysisFailure | null {
  const codes = useSongLibrary((s) => s.codes);
  const files = useRowFiles(row);
  return row?.kind === 'song' ? analysisFailure(row, codes, files) : null;
}

function useSongRow(songId: number): LibraryRow | null {
  return useSongLibrary(
    (s) =>
      s.rows.find((row) => row.kind === 'song' && row.id === songId) ?? null,
  );
}

export function useSongFailure(songId: number): AnalysisFailure | null {
  return useRowFailure(useSongRow(songId));
}

export function useSongFiles(songId: number): RowFiles | null {
  return useRowFiles(useSongRow(songId));
}
