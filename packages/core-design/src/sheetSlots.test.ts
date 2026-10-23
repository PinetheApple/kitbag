import { describe, expect, it } from 'vitest';

import { removeSheet, upsertSheet } from './sheetSlots.ts';

describe('sheet slots', () => {
  it('stacks sheets in the order they opened', () => {
    const slots = upsertSheet(upsertSheet([], 'a', 'A'), 'b', 'B');
    expect(slots.map((slot) => slot.id)).toEqual(['a', 'b']);
  });

  it('updates an open sheet in place', () => {
    const slots = upsertSheet(
      upsertSheet(upsertSheet([], 'a', 'A'), 'b', 'B'),
      'a',
      'A2',
    );
    expect(slots).toEqual([
      { id: 'a', node: 'A2' },
      { id: 'b', node: 'B' },
    ]);
  });

  it('removes a closed sheet and leaves the list alone when it was not open', () => {
    const slots = upsertSheet([], 'a', 'A');
    expect(removeSheet(slots, 'a')).toEqual([]);
    expect(removeSheet(slots, 'z')).toBe(slots);
  });
});
