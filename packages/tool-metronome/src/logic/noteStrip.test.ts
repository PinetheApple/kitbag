import { describe, expect, it } from 'vitest';

import { noteStrip } from './noteStrip.ts';

describe('noteStrip', () => {
  it('takes one line for a song with notes and for one without', () => {
    const withNotes = noteStrip(true, 'Fingerstyle — count 3');
    const without = noteStrip(true, null);
    expect(withNotes).not.toBeNull();
    expect(without).not.toBeNull();
    expect(noteStrip(true, '   ')).toEqual(without);
  });

  it('folds multi-line notes onto the one line', () => {
    expect(noteStrip(true, 'Capo 2\n\ncount  3')?.text).toBe('Capo 2 count 3');
  });

  it('speaks only real notes', () => {
    expect(noteStrip(true, null)?.spoken).toBeNull();
    expect(noteStrip(true, 'Capo 2')?.spoken).toBe('Song notes: Capo 2');
  });

  it('draws nothing with no song loaded', () => {
    expect(noteStrip(false, null)).toBeNull();
  });
});
