// Percentage widths plus a dp gap overflow and wrap; flex:1 rows cannot.
// A short last row is padded with undefined to keep column widths.
export function pickerRows<T>(
  items: readonly T[],
  columns: number,
): (T | undefined)[][] {
  const rows: (T | undefined)[][] = [];
  for (let start = 0; start < items.length; start += columns) {
    rows.push(Array.from({ length: columns }, (_, i) => items[start + i]));
  }
  return rows;
}
