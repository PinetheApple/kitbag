import type {
  StemDeckConstants,
  StemDeckImportSnapshot,
} from '@kitbag/core-native';

import type {
  BundleAddOutcome,
  BundleRefusal,
  ReplaceChoice,
} from '../songLibrary/stemBundleLogic.ts';
import { errorCode } from '../songLibrary/stemBundleLogic.ts';
import type { ReplaceMatch } from '../songLibrary/store.ts';
import { warn } from '../songLibrary/storeSupport.ts';
import type { CatalogSong } from './catalog.ts';
import { nativeFailure, type StemDeckFailure } from './failures.ts';
import { createHandOff } from './handOff.ts';
import { importView, type ImportView, type SkippedSong } from './importView.ts';
import { ADD, replaceRequest } from './replaceCodes.ts';
import { stemDeckCodes } from './runtime.ts';
import type { Get, SetState, StemDeckDeps } from './store.ts';

export interface StemDeckReplacePrompt {
  readonly match: ReplaceMatch;
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
  keepBoth: () => Promise<boolean>;
  dismissReplace: () => void;
  cancelImport: () => void;
  retryImport: () => Promise<void>;
  clearImport: () => Promise<boolean>;
  setWatching: (watching: boolean) => void;
  markUnityNoticeSeen: () => void;
}

type ReplaceTargets = ReadonlyMap<string, ReplaceChoice>;

interface PendingImport {
  readonly origin: string;
  readonly songs: readonly CatalogSong[];
  readonly kept: readonly CatalogSong[];
  readonly targets: ReplaceTargets;
  readonly stages: readonly ReplaceMatch[];
}

const isSameSong = (s: CatalogSong) => !s.inLibrary && s.sameSong !== null;

function stageSongs(
  songs: readonly CatalogSong[],
  stage: ReplaceMatch,
): CatalogSong[] {
  return songs.filter(stage === 'job' ? (s) => s.inLibrary : isSameSong);
}

function stagesFor(songs: readonly CatalogSong[]): ReplaceMatch[] {
  const stages: ReplaceMatch[] = ['job', 'song'];
  return stages.filter((stage) => stageSongs(songs, stage).length > 0);
}

function replaceChoice(song: CatalogSong): ReplaceChoice {
  return song.sameSong === null || song.inLibrary
    ? { kind: 'replaceJob' }
    : { kind: 'replaceSet', targetId: song.sameSong.id };
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
      s.jobId === jobId ? { ...s, inLibrary: true, sameSong: null } : s,
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
    targets: ReplaceTargets,
  ) => {
    const known = codes();
    if (known === null) return false;
    skipped = kept.map(({ jobId, title }) => ({ jobId, title }));
    refusals.clear();
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
      ...replaceRequest(targets.get(s.jobId) ?? ADD, known),
    }));
    try {
      await deps.native().startImport(origin, items);
      return true;
    } catch (error) {
      set({ importFailure: nativeFailure(errorCode(error), known) });
      return false;
    }
  };

  const failed = (error: unknown, known: StemDeckConstants | null) => {
    if (known !== null)
      set({ importFailure: nativeFailure(errorCode(error), known) });
  };

  const forgetImport = () => {
    skipped = [];
    refusals.clear();
    set({ importView: null, importFailure: null });
  };

  const takePending = () => {
    const job = pending;
    pending = null;
    set({ replacePrompt: null });
    return job;
  };

  const proceed = async (job: PendingImport): Promise<boolean> => {
    const [stage] = job.stages;
    if (stage === undefined) {
      const kept = new Set(job.kept.map((s) => s.jobId));
      const songs = job.songs.filter((s) => !kept.has(s.jobId));
      return begin(job.origin, songs, job.kept, job.targets);
    }
    pending = job;
    const titles = stageSongs(job.songs, stage).map((s) => s.title);
    set({ replacePrompt: { match: stage, titles } });
    return false;
  };

  const answer = async (
    choose: (job: PendingImport, stage: ReplaceMatch) => PendingImport,
  ): Promise<boolean> => {
    const job = takePending();
    const stage = job?.stages[0];
    if (job === null || stage === undefined) return false;
    return proceed({ ...choose(job, stage), stages: job.stages.slice(1) });
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
      return proceed({
        origin: connection.origin,
        songs,
        kept: [],
        targets: new Map(),
        stages: stagesFor(songs),
      });
    },
    replaceInLibrary: () =>
      answer((job, stage) => {
        const targets = new Map(job.targets);
        for (const song of stageSongs(job.songs, stage))
          targets.set(song.jobId, replaceChoice(song));
        return { ...job, targets };
      }),
    keepInLibrary: () =>
      answer((job, stage) => ({
        ...job,
        kept: [...job.kept, ...stageSongs(job.songs, stage)],
      })),
    keepBoth: () => answer((job) => job),
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
        failed(error, known);
      }
    },
    clearImport: async () => {
      const known = codes();
      try {
        const cleared = await deps.native().clearImport();
        if (cleared) forgetImport();
        return cleared;
      } catch (error) {
        failed(error, known);
        return false;
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
