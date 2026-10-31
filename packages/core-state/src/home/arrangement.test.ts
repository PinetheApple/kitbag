import { describe, expect, it } from 'vitest';

import {
  hiddenTiles,
  hideTile,
  moveTile,
  reconcileArrangement,
  resizeTile,
  showTile,
  visibleTiles,
  type ArrangedTile,
} from './arrangement.ts';

type Size = 'small' | 'wide';

const SIZES: readonly string[] = ['small', 'wide'];
const isSize = (value: string): value is Size => SIZES.includes(value);

const tile = (
  toolId: string,
  size: Size = 'small',
  hidden = false,
): ArrangedTile<Size> => ({ toolId, size, hidden });

const ids = (tiles: readonly ArrangedTile<string>[]) =>
  tiles.map((t) => t.toolId);

const DEFAULTS = [tile('a'), tile('b'), tile('c'), tile('d')];

describe('moveTile', () => {
  it('moves a tile to a later position', () => {
    expect(ids(moveTile(DEFAULTS, 'a', 2))).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves a tile to an earlier position', () => {
    expect(ids(moveTile(DEFAULTS, 'd', 0))).toEqual(['d', 'a', 'b', 'c']);
  });

  it('leaves the first tile in place when moved before the start', () => {
    expect(moveTile(DEFAULTS, 'a', -1)).toBe(DEFAULTS);
  });

  it('leaves the last tile in place when moved past the end', () => {
    expect(moveTile(DEFAULTS, 'd', 4)).toBe(DEFAULTS);
  });

  it('clamps a far target to the last visible slot, before hidden tools', () => {
    const arranged = [tile('a'), tile('b'), tile('c', 'small', true)];
    expect(ids(moveTile(arranged, 'a', 9))).toEqual(['b', 'a', 'c']);
  });

  it('does not move a hidden tool', () => {
    const arranged = [tile('a'), tile('b', 'small', true)];
    expect(moveTile(arranged, 'b', 0)).toBe(arranged);
  });

  it('ignores an unknown tool', () => {
    expect(moveTile(DEFAULTS, 'zz', 0)).toBe(DEFAULTS);
  });
});

describe('resizeTile', () => {
  it('sets the size of one tile and nothing else', () => {
    const resized = resizeTile(DEFAULTS, 'b', 'wide');
    expect(resized.map((t) => t.size)).toEqual([
      'small',
      'wide',
      'small',
      'small',
    ]);
  });

  it('returns the same arrangement when the size is unchanged', () => {
    expect(resizeTile(DEFAULTS, 'b', 'small')).toBe(DEFAULTS);
  });
});

describe('hideTile and showTile', () => {
  it('hides a tool into the hidden section, keeping its size', () => {
    const hidden = hideTile(resizeTile(DEFAULTS, 'b', 'wide'), 'b');
    expect(ids(visibleTiles(hidden))).toEqual(['a', 'c', 'd']);
    expect(hiddenTiles(hidden)).toEqual([tile('b', 'wide', true)]);
  });

  it('lists hidden tools in the order they were hidden', () => {
    const hidden = hideTile(hideTile(DEFAULTS, 'c'), 'a');
    expect(ids(hiddenTiles(hidden))).toEqual(['c', 'a']);
  });

  it('shows a hidden tool at the end of the visible tiles', () => {
    const shown = showTile(hideTile(hideTile(DEFAULTS, 'a'), 'b'), 'a');
    expect(ids(visibleTiles(shown))).toEqual(['c', 'd', 'a']);
    expect(ids(hiddenTiles(shown))).toEqual(['b']);
  });

  it('leaves a visible tool alone when asked to show it', () => {
    expect(showTile(DEFAULTS, 'a')).toBe(DEFAULTS);
  });

  it('leaves a hidden tool alone when asked to hide it', () => {
    const hidden = hideTile(DEFAULTS, 'a');
    expect(hideTile(hidden, 'a')).toBe(hidden);
  });
});

describe('reconcileArrangement', () => {
  it('uses the default arrangement when nothing is saved', () => {
    expect(reconcileArrangement(undefined, DEFAULTS, isSize)).toBe(DEFAULTS);
  });

  it('keeps the saved order, sizes and hidden tools', () => {
    const saved = [
      tile('c', 'wide'),
      tile('a'),
      tile('b'),
      tile('d', 'small', true),
    ];
    expect(reconcileArrangement(saved, DEFAULTS, isSize)).toEqual(saved);
  });

  it('appends a tool added since the save at its default size, before hidden tools', () => {
    const defaults = [...DEFAULTS, tile('e', 'wide')];
    const saved = [tile('b'), tile('a'), tile('c'), tile('d', 'small', true)];
    expect(reconcileArrangement(saved, defaults, isSize)).toEqual([
      tile('b'),
      tile('a'),
      tile('c'),
      tile('e', 'wide'),
      tile('d', 'small', true),
    ]);
  });

  it('drops a tool that no longer exists', () => {
    const saved = [tile('a'), tile('gone'), tile('b'), tile('c'), tile('d')];
    expect(ids(reconcileArrangement(saved, DEFAULTS, isSize))).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('keeps the first of two saved entries for the same tool', () => {
    const saved = [tile('a', 'wide'), tile('b'), tile('a'), tile('c')];
    const reconciled = reconcileArrangement(saved, DEFAULTS, isSize);
    expect(ids(reconciled)).toEqual(['a', 'b', 'c', 'd']);
    expect(reconciled[0]?.size).toBe('wide');
  });

  it('falls back to the default size for a size no longer offered', () => {
    const saved = [{ toolId: 'a', size: 'huge', hidden: false }];
    expect(reconcileArrangement(saved, DEFAULTS, isSize)[0]).toEqual(tile('a'));
  });

  it('puts saved hidden tools after the visible ones', () => {
    const saved = [tile('a', 'small', true), tile('b'), tile('c'), tile('d')];
    expect(ids(reconcileArrangement(saved, DEFAULTS, isSize))).toEqual([
      'b',
      'c',
      'd',
      'a',
    ]);
  });
});
