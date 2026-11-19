import {
  KB_MIXDOWN_STATE,
  KB_RESULT,
  type MixdownStart,
} from '@kitbag/core-native';

import { errorCode } from '../songLibrary/stemBundleLogic.ts';

import { summarizeExport, type ExportSummary } from './exportSummary.ts';
import {
  EXPORT_READY,
  EXPORT_SHARE_FAILED,
  EXPORT_STARTED,
  EXPORT_UNSHARED,
  exportFailureCopy,
  exportProgressNote,
  type ExportFailure,
} from './exportText.ts';
import type { ActionContext, StemPlayerStore } from './store.ts';

export const EXPORT_POLL_MS = 250;
const QUARTERS = 4;
const PERCENT_PER_QUARTER = 25;

export interface ExportSong {
  readonly setId: number;
  readonly title: string;
}

interface ExportFile {
  readonly song: ExportSong;
  readonly fileName: string;
  readonly path: string;
  readonly bytes: number;
}

export type ExportState =
  | { readonly kind: 'idle' }
  | ({ readonly kind: 'running' } & ExportFile)
  | ({ readonly kind: 'ready' } & ExportFile)
  | ({ readonly kind: 'unshared'; readonly noTarget: boolean } & ExportFile)
  | {
      readonly kind: 'failed';
      readonly song: ExportSong;
      readonly failure: ExportFailure;
      readonly bytes: number;
    }
  | { readonly kind: 'cancelled' };

type Finished = Extract<ExportState, { kind: 'ready' | 'unshared' }>;
type Running = Extract<ExportState, { kind: 'running' }>;

export const NO_EXPORT: ExportState = { kind: 'idle' };

export interface ExportSlice {
  readonly exportState: ExportState;
}

export interface ExportActions {
  readonly readExportSummary: () => Promise<ExportSummary>;
  readonly startExport: () => Promise<void>;
  readonly cancelExport: () => void;
  readonly shareExport: () => Promise<void>;
  readonly dismissExport: () => void;
  readonly exportProgress: () => number;
}

export type ExportBlock = 'running' | 'noStems' | 'allMuted';

export function exportBlock(
  state: Pick<StemPlayerStore, 'exportState' | 'stems'>,
): ExportBlock | null {
  if (state.exportState.kind === 'running') return 'running';
  const loaded = state.stems.filter((row) => row.loaded);
  if (loaded.length === 0) return 'noStems';
  if (loaded.every((row) => row.muted)) return 'allMuted';
  return null;
}

function failureFor(result: number): ExportFailure {
  switch (result) {
    case KB_RESULT.KB_ERROR_NO_SPACE:
      return 'noSpace';
    case KB_RESULT.KB_ERROR_TOO_LONG:
      return 'tooLong';
    case KB_RESULT.KB_ERROR_BUSY:
      return 'busy';
    default:
      return 'internal';
  }
}

function fileOf({ song, fileName, path, bytes }: ExportFile): ExportFile {
  return { song, fileName, path, bytes };
}

function isFinished(state: ExportState): state is Finished {
  return state.kind === 'ready' || state.kind === 'unshared';
}

// The render outlives the player screen and the song session, so nothing here
// is tied to session(): only a new export or a dismissal replaces the state.
export function exportActions({
  set,
  get,
  runtimeOf,
}: ActionContext): ExportActions {
  let timer: ReturnType<typeof setInterval> | null = null;
  let quarter = 0;
  let starting = false;
  let settled: Promise<void> = Promise.resolve();
  let settle: () => void = () => undefined;

  const mixdown = () => runtimeOf().mixdown;
  const setExport = (exportState: ExportState) => {
    set({ exportState });
  };
  const sameFile = (file: Finished) => {
    const current = get().exportState;
    return isFinished(current) && current.path === file.path;
  };
  const isNoShareTarget = (error: unknown) => {
    try {
      return errorCode(error) === mixdown().codes().exportNoShareTarget;
    } catch (codesError: unknown) {
      console.warn('[kitbag] library constants unavailable', codesError);
      return false;
    }
  };
  const fail = (song: ExportSong, failure: ExportFailure, bytes: number) => {
    setExport({ kind: 'failed', song, failure, bytes });
    mixdown().announce(exportFailureCopy(failure, bytes).title);
  };

  const share = async () => {
    const file = get().exportState;
    if (!isFinished(file)) return;
    try {
      await mixdown().share(file.path);
      if (sameFile(file)) setExport({ ...fileOf(file), kind: 'ready' });
    } catch (error: unknown) {
      console.warn('[kitbag] mix not shared', error);
      if (!sameFile(file)) return;
      const noTarget = isNoShareTarget(error);
      setExport({ ...fileOf(file), kind: 'unshared', noTarget });
      mixdown().announce(
        (noTarget ? EXPORT_UNSHARED : EXPORT_SHARE_FAILED).title,
      );
    }
  };

  const stopPolling = () => {
    if (timer !== null) clearInterval(timer);
    timer = null;
    settle();
  };

  const announceQuarter = () => {
    const reached = Math.floor(Math.min(1, mixdown().progress()) * QUARTERS);
    if (reached <= quarter || reached >= QUARTERS) return;
    quarter = reached;
    mixdown().announce(exportProgressNote(reached * PERCENT_PER_QUARTER));
  };

  const finish = (running: Running) => {
    setExport({ ...running, kind: 'ready' });
    mixdown().announce(EXPORT_READY);
    if (mixdown().foreground()) void share();
  };

  const poll = () => {
    const engineState = mixdown().state();
    const current = get().exportState;
    if (engineState === KB_MIXDOWN_STATE.KB_MIXDOWN_STATE_RUNNING) {
      if (current.kind === 'running') announceQuarter();
      return;
    }
    stopPolling();
    if (current.kind !== 'running') return;
    if (engineState === KB_MIXDOWN_STATE.KB_MIXDOWN_STATE_DONE) finish(current);
    else if (engineState === KB_MIXDOWN_STATE.KB_MIXDOWN_STATE_CANCELLED)
      setExport({ kind: 'cancelled' });
    else fail(current.song, 'internal', current.bytes);
  };

  const beginPolling = () => {
    quarter = 0;
    settled = new Promise((resolve) => {
      settle = resolve;
    });
    timer = setInterval(poll, EXPORT_POLL_MS);
  };

  const begin = async () => {
    const state = get();
    if (state.setId === null || exportBlock(state) !== null) return;
    const song = { setId: state.setId, title: state.title };
    let summary: ExportSummary;
    let started: MixdownStart;
    try {
      summary = await summarizeExport(state, runtimeOf().commands);
    } catch (error: unknown) {
      console.warn('[kitbag] mix not summarised', error);
      fail(song, 'internal', 0);
      return;
    }
    try {
      started = await mixdown().start(summary.fileName);
    } catch (error: unknown) {
      console.warn('[kitbag] mix export refused', error);
      fail(song, 'internal', summary.bytes);
      return;
    }
    if (started.result !== KB_RESULT.KB_OK) {
      fail(song, failureFor(started.result), summary.bytes);
      return;
    }
    const { fileName, bytes } = summary;
    setExport({ kind: 'running', song, fileName, path: started.path, bytes });
    mixdown().announce(EXPORT_STARTED);
    beginPolling();
  };

  return {
    readExportSummary: () => summarizeExport(get(), runtimeOf().commands),
    startExport: async () => {
      if (starting) return;
      starting = true;
      try {
        await settled;
        await begin();
      } finally {
        starting = false;
      }
    },
    cancelExport: () => {
      if (get().exportState.kind !== 'running') return;
      mixdown().cancel();
      setExport({ kind: 'cancelled' });
    },
    shareExport: share,
    dismissExport: () => {
      if (get().exportState.kind !== 'running') setExport(NO_EXPORT);
    },
    exportProgress: () => mixdown().progress(),
  };
}
