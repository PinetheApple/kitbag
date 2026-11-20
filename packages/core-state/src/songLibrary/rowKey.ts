import type { LibraryRow } from '@kitbag/core-db';

export function rowKey(row: Pick<LibraryRow, 'kind' | 'id'>): string {
  return `${row.kind}:${String(row.id)}`;
}
