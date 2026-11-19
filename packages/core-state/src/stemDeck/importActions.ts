import type {
  StemDeckConstants,
  StemDeckImportSnapshot,
} from '@kitbag/core-native';

import type {
  BundleAddOutcome,
  BundleRefusal,
} from '../songLibrary/stemBundleLogic.ts';
import { errorCode } from '../songLibrary/stemBundleLogic.ts';
import { warn } from '../songLibrary/storeSupport.ts';
import type { CatalogSong } from './catalog.ts';
import { nativeFailure, type StemDeckFailure } from './failures.ts';
import { createHandOff } from './handOff.ts';
import { importView, type ImportView, type SkippedSong } from './importView.ts';
import { stemDeckCodes } from './runtime.ts';
import type { Get, SetState, StemDeckDeps } from './store.ts';

export interface StemDeckReplacePrompt {
  readonly titles: readonly string[];
}

export interface ImportState {
  readonly importView: ImportView | null;
  readonly importFailure: StemDeckFailure | null;
  readonly replacePrompt: StemDeckReplacePrompt | null;
  readonly unityNoticeSeen: boolean;
}

export interface ImportActions {
  start: () => Promise<() => void>;
  importSelected: () => Promise<boolean>;
  replaceInLibrary: () => Promise<boolean>;
  keepInLibrary: () => Promise<boolean>;
  dismissReplace: () => void;
  cancelImport: () => void;
  retryImport: () => Promise<void>;
  setWatching: (watching: boolean) => void;
  markUnityNoticeSeen: () => void;
}

interface PendingImport {
  readonly origin: string;
  readonly songs: readonly CatalogSong[];
}

export function importActions(
  deps: StemDeckDeps,
  set: SetState,
  get: Get,
): ImportActions {
  let pending: PendingImport | null = null;
  let stop: (() => void) | null = null;
  let skipped: SkippedSong[] = [];
  const refusals = new Map<string, BundleRefusal>();

  const codes = () => {
    const known = stemDeckCodes(deps.native, get().codes);
    if (known !== null) set({ codes: known });
    return known;
  };

  const markOwned = (jobId: string) => {
    const { catalog } = get();
    if (catalog === null) return;
    const songs = catalog.songs.map((s) =>
      s.jobId === jobId ? { ...s, inLibrary: true } : s,
    );
    set({ catalog: { ...catalog, songs } });
  };

  const handOff = createHandOff({
    addFetchedBundle: deps.addFetchedBundle,
    settle: (jobId, outcome) => {
      deps.native().settleDownload(jobId, outcome);
    },
    settled: (jobId: string, outcome: BundleAddOutcome | null) => {
      if (outcome?.kind === 'refused') refusals.set(jobId, outcome.refusal);
      if (outcome?.kind === 'added') markOwned(jobId);
    },
  });

  const receive = (
    snapshot: StemDeckImportSnapshot,
    known: StemDeckConstants,
  ) => {
    set({ importView: importView(snapshot, known, skipped, refusals) });
    handOff.receive(snapshot, known).catch((error: unknown) => {
      warn('StemDeck hand-off failed', error);
    });
  };

  const begin = async (
    origin: string,
    songs: readonly CatalogSong[],
    kept: readonly CatalogSong[],
    replace: readonly CatalogSong[],
  ) => {
    const known = codes();
    if (known === null) return false;
    skipped = kept.map(({ jobId, title }) => ({ jobId, title }));
    refusals.clear();
    handOff.replacing(replace.map((s) => s.jobId));
    set({ selected: [], importFailure: null, replacePrompt: null });
    if (songs.length === 0) {
      const empty = { origin, running: false, stopReason: null, items: [] };
      set({ importView: importView(empty, known, skipped, refusals) });
      return false;
    }
    const items = songs.map((s) => ({
      jobId: s.jobId,
      title: s.title,
      stems: [...s.lanes],
    }));
    try {
      await deps.native().startImport(origin, items);
      return true;
    } catch (error) {
      set({ importFailure: nativeFailure(errorCode(error), known) });
      return false;
    }
  };

  const takePending = () => {
    const job = pending;
    pending = null;
    set({ replacePrompt: null });
    return job;
  };

  return {
    start: async () => {
      if (stop !== null) return stop;
      const known = codes();
      if (known === null) return () => undefined;
      const events = { heard: false };
      const unsubscribe = deps.native().onImport((snapshot) => {
        events.heard = true;
        receive(snapshot, known);
      });
      const stopListening = () => {
        unsubscribe();
        stop = null;
      };
      stop = stopListening;
      try {
        const first = await deps.native().importSnapshot();
        if (!events.heard) receive(first, known);
      } catch (error) {
        warn('StemDeck import state unavailable', error);
      }
      return stopListening;
    },
    importSelected: async () => {
      const { catalog, selected, connection } = get();
      if (catalog === null || connection.status !== 'connected') return false;
      const songs = catalog.songs.filter((s) => selected.includes(s.jobId));
      if (songs.length === 0) return false;
      const owned = songs.filter((s) => s.inLibrary);
      if (owned.length === 0) return begin(connection.origin, songs, [], []);
      pending = { origin: connection.origin, songs };
      set({ replacePrompt: { titles: owned.map((s) => s.title) } });
      return false;
    },
    replaceInLibrary: async () => {
      const job = takePending();
      if (job === null) return false;
      const owned = job.songs.filter((s) => s.inLibrary);
      return begin(job.origin, job.songs, [], owned);
    },
    keepInLibrary: async () => {
      const job = takePending();
      if (job === null) return false;
      const fresh = job.songs.filter((s) => !s.inLibrary);
      const owned = job.songs.filter((s) => s.inLibrary);
      return begin(job.origin, fresh, owned, []);
    },
    dismissReplace: () => {
      takePending();
    },
    cancelImport: () => {
      deps.native().cancelImport();
    },
    retryImport: async () => {
      const known = codes();
      try {
        await deps.native().retryImport();
      } catch (error) {
        if (known !== null)
          set({ importFailure: nativeFailure(errorCode(error), known) });
      }
    },
    setWatching: (watching: boolean) => {
      try {
        deps.native().setWatching(watching);
      } catch (error) {
        warn('StemDeck watching not set', error);
      }
    },
    markUnityNoticeSeen: () => {
      if (get().unityNoticeSeen) return;
      set({ unityNoticeSeen: true });
      deps.unityNotice().save();
    },
  };
}
