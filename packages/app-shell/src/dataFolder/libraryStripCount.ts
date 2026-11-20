import {
  inView,
  rowFilesOf,
  type LibraryRow,
  type LibraryView,
  type RowFiles,
} from '@kitbag/core-state';

export function unavailableCount(
  rows: readonly LibraryRow[],
  rowFiles: ReadonlyMap<string, RowFiles>,
  view: LibraryView,
): number {
  return rows.filter(
    (row) => inView(row, view) && rowFilesOf(rowFiles, row) === 'unavailable',
  ).length;
}
