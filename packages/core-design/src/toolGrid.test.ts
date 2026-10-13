import { describe, expect, it } from 'vitest';

import { packTileRows, type ToolTileSize } from './toolGrid.ts';

const tile = (id: string, size: ToolTileSize = '1x1') => ({ id, size });
const ids = (rows: readonly (readonly { id: string }[])[]) =>
  rows.map((row) => row.map((t) => t.id));

describe('packTileRows', () => {
  it('pairs 1x1 tiles into a 2x2 grid', () => {
    expect(
      ids(packTileRows([tile('a'), tile('b'), tile('c'), tile('d')])),
    ).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('gives a 2x1 tile a row of its own', () => {
    expect(ids(packTileRows([tile('a', '2x1'), tile('b'), tile('c')]))).toEqual(
      [['a'], ['b', 'c']],
    );
  });

  it('keeps order rather than backfilling past a 2x1', () => {
    expect(ids(packTileRows([tile('a'), tile('b', '2x1'), tile('c')]))).toEqual(
      [['a'], ['b'], ['c']],
    );
  });

  it('leaves an odd trailing 1x1 alone in its row', () => {
    expect(ids(packTileRows([tile('a'), tile('b'), tile('c')]))).toEqual([
      ['a', 'b'],
      ['c'],
    ]);
  });
});
