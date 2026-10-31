export const TOOL_TILE_SIZES = ['1x1', '2x1'] as const;

export type ToolTileSize = (typeof TOOL_TILE_SIZES)[number];

export function isToolTileSize(value: string): value is ToolTileSize {
  return TOOL_TILE_SIZES.some((size) => size === value);
}

export interface SizedTile {
  readonly size: ToolTileSize;
}

const COLUMNS = 2;

// Order is preserved, never backfilled: a 1x1 left alone before a 2x1 keeps a
// half-empty row, as a launcher does, so a tile never jumps past its neighbour.
export function packTileRows<T extends SizedTile>(
  tiles: readonly T[],
): (readonly T[])[] {
  const rows: T[][] = [];
  let open: T[] = [];
  for (const tile of tiles) {
    if (tile.size === '2x1') {
      if (open.length > 0) rows.push(open);
      open = [];
      rows.push([tile]);
      continue;
    }
    open.push(tile);
    if (open.length === COLUMNS) {
      rows.push(open);
      open = [];
    }
  }
  if (open.length > 0) rows.push(open);
  return rows;
}
