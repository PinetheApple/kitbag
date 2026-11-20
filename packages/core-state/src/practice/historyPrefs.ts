import { persistedStore } from '../persistedStore.ts';
import { DEFAULT_HISTORY_GROUPING, type HistoryGrouping } from './history.ts';

export const SWIPE_DIRECTION = { left: 'left', right: 'right' } as const;

export type SwipeDirection =
  (typeof SWIPE_DIRECTION)[keyof typeof SWIPE_DIRECTION];

export const DEFAULT_SWIPE_DIRECTION: SwipeDirection = SWIPE_DIRECTION.left;

export function isSwipeDirection(value: unknown): value is SwipeDirection {
  return Object.values(SWIPE_DIRECTION).some(
    (direction) => direction === value,
  );
}

export interface HistoryPrefs {
  readonly grouping: HistoryGrouping;
  readonly swipeDirection: SwipeDirection;
}

export interface HistoryPrefsPersistence {
  readonly load: () => Partial<HistoryPrefs>;
  readonly save: (changed: Partial<HistoryPrefs>) => void;
}

export interface HistoryPrefsStore extends HistoryPrefs {
  readonly setGrouping: (grouping: HistoryGrouping) => void;
  readonly setSwipeDirection: (direction: SwipeDirection) => void;
}

const historyPrefs = persistedStore<HistoryPrefsPersistence, HistoryPrefsStore>(
  'Practice history preferences',
  { load: () => ({}), save: () => undefined },
  (persistence, commit) => {
    const stored = persistence.load();
    return {
      grouping: stored.grouping ?? DEFAULT_HISTORY_GROUPING,
      swipeDirection: stored.swipeDirection ?? DEFAULT_SWIPE_DIRECTION,
      setGrouping: (grouping) => {
        commit('grouping', grouping, () => {
          persistence.save({ grouping });
        });
      },
      setSwipeDirection: (swipeDirection) => {
        commit('swipeDirection', swipeDirection, () => {
          persistence.save({ swipeDirection });
        });
      },
    };
  },
);

export const createHistoryPrefsStore = historyPrefs.create;
export const configureHistoryPrefsPersistence = historyPrefs.configure;
export const getHistoryPrefsStore = historyPrefs.get;
