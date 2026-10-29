import { configureSwipeHintPersistence } from '@kitbag/core-state';

const KEY = 'kitbag.swipeHintSeen';
const SEEN = '1';

// localStorage throws when storage is disabled; the hint then shows again next
// launch rather than failing the screen.
configureSwipeHintPersistence({
  load: () => {
    try {
      return globalThis.localStorage.getItem(KEY) === SEEN;
    } catch {
      return false;
    }
  },
  save: () => {
    try {
      globalThis.localStorage.setItem(KEY, SEEN);
    } catch {
      // Unpersisted is still correct for this session.
    }
  },
});
