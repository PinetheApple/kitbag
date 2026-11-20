import { describe, expect, it, vi } from 'vitest';

import {
  addedToSetlistNotice,
  pickerSubtitle,
  type SetlistPick,
} from './setlistPickText.ts';

const pick: SetlistPick = {
  id: 5,
  name: 'Gig',
  onStage: true,
  songCount: 5,
  stemCount: 4,
  holds: false,
};

describe('setlist picker row', () => {
  it('counts the songs, the stem songs among them, and whether it is on stage', () => {
    expect(pickerSubtitle(pick)).toBe('5 songs · 4 stem songs · on stage');
    expect(
      pickerSubtitle({ ...pick, onStage: false, songCount: 1, stemCount: 0 }),
    ).toBe('1 song');
  });
});

describe('the added-to-setlist notice', () => {
  it('names the setlist and opens it', () => {
    const open = vi.fn();
    const notice = addedToSetlistNotice({ setlistId: 5, name: 'Gig' }, open);
    expect(notice.message).toBe('Added to Gig');
    expect(notice.action?.label).toBe('Open');
    notice.action?.onPress();
    expect(open).toHaveBeenCalledWith(5);
  });
});
