import type {
  DeletedPracticeSession,
  PracticeRepository,
  PracticeSessionListing,
  PracticeStats,
  SavedPracticeSession,
} from '@kitbag/core-db';
import { createStore, type StoreApi } from 'zustand/vanilla';

export type PracticeHistoryRepository = Pick<
  PracticeRepository,
  'list' | 'stats' | 'get' | 'delete' | 'restore'
>;

export interface PracticeHistoryState {
  readonly ready: boolean;
  readonly failed: boolean;
  readonly sessions: readonly PracticeSessionListing[];
  readonly stats: PracticeStats | null;
  readonly deleted: DeletedPracticeSession | null;
}

export interface PracticeHistoryActions {
  refresh: () => Promise<void>;
  getSession: (uuid: string) => Promise<SavedPracticeSession | undefined>;
  remove: (uuid: string) => Promise<void>;
  undo: () => Promise<void>;
  dismissDeleted: () => void;
}

export type PracticeHistoryStore = PracticeHistoryState &
  PracticeHistoryActions;

export function createPracticeHistoryStore(
  repo: () => PracticeHistoryRepository,
): StoreApi<PracticeHistoryStore> {
  return createStore<PracticeHistoryStore>((set, get) => ({
    ready: false,
    failed: false,
    sessions: [],
    stats: null,
    deleted: null,
    refresh: async () => {
      try {
        const [sessions, stats] = await Promise.all([
          repo().list(),
          repo().stats(),
        ]);
        set({ ready: true, failed: false, sessions, stats });
      } catch (error) {
        console.warn('[kitbag] practice history load failed', error);
        set({ ready: true, failed: true });
      }
    },
    getSession: (uuid) => repo().get(uuid),
    remove: async (uuid) => {
      const deleted = await repo().delete(uuid);
      if (deleted !== undefined) set({ deleted });
      await get().refresh();
    },
    undo: async () => {
      const { deleted } = get();
      if (deleted === null) return;
      set({ deleted: null });
      await repo().restore(deleted);
      await get().refresh();
    },
    dismissDeleted: () => {
      set({ deleted: null });
    },
  }));
}

let configured: StoreApi<PracticeHistoryStore> | undefined;

const notConfigured = () =>
  Promise.reject(new Error('Practice history is not configured'));

const unconfigured: PracticeHistoryRepository = {
  list: notConfigured,
  stats: notConfigured,
  get: notConfigured,
  delete: notConfigured,
  restore: notConfigured,
};

export function configurePracticeHistory(
  repo: () => PracticeHistoryRepository,
): void {
  if (configured !== undefined)
    throw new Error(
      'Practice history store already exists; configure it before first use',
    );
  configured = createPracticeHistoryStore(repo);
}

export function getPracticeHistoryStore(): StoreApi<PracticeHistoryStore> {
  configured ??= createPracticeHistoryStore(() => unconfigured);
  return configured;
}
