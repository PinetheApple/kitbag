import type { LibraryRow, RowFiles } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import { unavailableCount } from './libraryStripCount.ts';

const ROWS = [
  { kind: 'song', id: 1 },
  { kind: 'song', id: 2 },
  { kind: 'stems', id: 1 },
] as unknown as LibraryRow[];

const FILES = new Map<string, RowFiles>([
  ['song:1', 'unavailable'],
  ['song:2', 'missing'],
  ['stems:1', 'unavailable'],
]);

describe('unavailableCount', () => {
  it('counts only rows on a missing card, never missing ones', () => {
    expect(unavailableCount(ROWS, FILES, 'songs')).toBe(1);
  });

  it('counts within the list on screen', () => {
    expect(unavailableCount(ROWS, FILES, 'stems')).toBe(1);
  });
});
