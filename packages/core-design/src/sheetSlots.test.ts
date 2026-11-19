import { describe, expect, it } from 'vitest';

import { removeSheet, upsertSheet } from './sheetSlots.ts';

describe('sheet slots', () => {
  it('stacks sheets in the order they opened', () => {
    const slots = upsertSheet(
      upsertSheet([], 'a', 'A', false),
      'b',
      'B',
      false,
    );
    expect(slots.map((slot) => slot.id)).toEqual(['a', 'b']);
  });

  it('updates an open sheet in place', () => {
    const slots = upsertSheet(
      upsertSheet(upsertSheet([], 'a', 'A', false), 'b', 'B', false),
      'a',
      'A2',
      false,
    );
    expect(slots).toEqual([
      { id: 'a', node: 'A2', leaving: false },
      { id: 'b', node: 'B', leaving: false },
    ]);
  });

  it('removes a closed sheet and leaves the list alone when it was not open', () => {
    const slots = upsertSheet([], 'a', 'A', false);
    expect(removeSheet(slots, 'a')).toEqual([]);
    expect(removeSheet(slots, 'z')).toBe(slots);
  });
});
