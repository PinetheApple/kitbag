import type {
  DeletedPreset,
  DeletedSetlist,
  RemovedSetlistItem,
} from '@kitbag/core-db';
import type { StoreApi } from 'zustand/vanilla';

import type { LibraryDeps, LibraryStore } from './store.ts';

export type LibraryDeletion =
  | {
      readonly kind: 'setlist';
      readonly at: number;
      readonly deleted: DeletedSetlist;
    }
  | {
      readonly kind: 'song';
      readonly at: number;
      readonly deleted: DeletedPreset;
    }
  | {
      readonly kind: 'entry';
      readonly at: number;
      readonly removed: RemovedSetlistItem;
    };

export interface LibraryDeletionActions {
  deleteSetlist: (setlistId: number) => Promise<void>;
  removeFromSet: (itemId: number) => Promise<void>;
  deletePreset: (presetId: number) => Promise<void>;
  undoDeletion: () => Promise<void>;
  dismissDeletion: () => void;
}

type SetState = StoreApi<LibraryStore>['setState'];
type Get = StoreApi<LibraryStore>['getState'];

function restore(deps: LibraryDeps, deletion: LibraryDeletion) {
  const { setlists, presets } = deps.repos();
  if (deletion.kind === 'setlist') return setlists.restore(deletion.deleted);
  if (deletion.kind === 'song') return presets.restore(deletion.deleted);
  return setlists.restoreItem(deletion.removed);
}

export function deletionActions(
  deps: LibraryDeps,
  set: SetState,
  get: Get,
): LibraryDeletionActions {
  const sets = () => deps.repos().setlists;
  return {
    deleteSetlist: async (setlistId) => {
      const deleted = await sets().delete(setlistId);
      if (deleted !== undefined)
        set({ deletion: { kind: 'setlist', at: deps.now(), deleted } });
      await get().refresh();
    },
    removeFromSet: async (itemId) => {
      const removed = await sets().removeItem(itemId);
      if (removed !== undefined)
        set({ deletion: { kind: 'entry', at: deps.now(), removed } });
      await get().refresh();
    },
    deletePreset: async (presetId) => {
      const deleted = await deps.repos().presets.delete(presetId);
      if (deleted !== undefined)
        set({ deletion: { kind: 'song', at: deps.now(), deleted } });
      if (get().loaded?.presetId === presetId) set({ loaded: null });
      await get().refresh();
    },
    undoDeletion: async () => {
      const { deletion } = get();
      if (deletion === null) return;
      await restore(deps, deletion);
      if (get().deletion === deletion) set({ deletion: null });
      await get().refresh();
    },
    dismissDeletion: () => {
      set({ deletion: null });
    },
  };
}
