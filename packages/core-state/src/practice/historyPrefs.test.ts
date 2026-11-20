import { describe, expect, it, vi } from 'vitest';

import { HISTORY_GROUPING } from './history.ts';
import {
  createHistoryPrefsStore,
  DEFAULT_SWIPE_DIRECTION,
  SWIPE_DIRECTION,
  type HistoryPrefsPersistence,
} from './historyPrefs.ts';

function persistence(stored: ReturnType<HistoryPrefsPersistence['load']>) {
  return {
    load: () => stored,
    save: vi.fn<HistoryPrefsPersistence['save']>(),
  };
}

describe('practice history preferences', () => {
  it('swipes left to delete until the user picks right', () => {
    const store = createHistoryPrefsStore(persistence({}));
    expect(store.getState().swipeDirection).toBe(DEFAULT_SWIPE_DIRECTION);
    expect(DEFAULT_SWIPE_DIRECTION).toBe(SWIPE_DIRECTION.left);
  });

  it('reads back the stored direction and grouping', () => {
    const store = createHistoryPrefsStore(
      persistence({
        swipeDirection: SWIPE_DIRECTION.right,
        grouping: HISTORY_GROUPING.month,
      }),
    );
    expect(store.getState()).toMatchObject({
      swipeDirection: SWIPE_DIRECTION.right,
      grouping: HISTORY_GROUPING.month,
    });
  });

  it('saves only the field that changed', () => {
    const stored = persistence({});
    const store = createHistoryPrefsStore(stored);
    store.getState().setSwipeDirection(SWIPE_DIRECTION.right);
    store.getState().setSwipeDirection(SWIPE_DIRECTION.right);
    store.getState().setGrouping(HISTORY_GROUPING.week);
    expect(stored.save.mock.calls).toEqual([
      [{ swipeDirection: SWIPE_DIRECTION.right }],
      [{ grouping: HISTORY_GROUPING.week }],
    ]);
  });
});
