import { configureLastToolPersistence } from '@kitbag/core-state';

const KEY = 'kitbag.lastTool';

// localStorage throws when storage is disabled; Home then simply has nothing
// to continue rather than failing to render.
configureLastToolPersistence({
  load: () => {
    try {
      return globalThis.localStorage.getItem(KEY) ?? undefined;
    } catch {
      return undefined;
    }
  },
  save: (toolId) => {
    try {
      globalThis.localStorage.setItem(KEY, toolId);
    } catch {
      // Unpersisted is still correct for this session.
    }
  },
});
