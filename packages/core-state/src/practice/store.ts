import { MS_PER_SECOND, type NewPracticeSession } from '@kitbag/core-db';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { activeSetView } from '../library/activeSet.ts';
import {
  libraryStore,
  loadedPresetOf,
  type LibraryState,
  type LibraryStore,
} from '../library/store.ts';
import { metronomeStore, type MetronomeStore } from '../metronome/store.ts';
import {
  endPracticeSession,
  MIN_SAVED_PLAYED_MS,
  PRACTICE_TEMPO_SAMPLE_MS,
  practiceSessionAfterContext,
  practiceSessionAfterRunning,
  practiceSessionAfterTempo,
  startPracticeSession,
  type PracticeContext,
  type PracticeSession,
  type PracticeSummary,
} from './session.ts';

export interface PracticePersistence {
  readonly insert: (session: NewPracticeSession) => Promise<void>;
}

export interface PracticeSessionState {
  readonly session: PracticeSession | null;
  readonly pending: readonly PracticeSummary[];
}

export interface PracticeSessionActions {
  endSession: () => PracticeSummary | null;
  saveSession: () => Promise<void>;
  discardSession: () => void;
}

export type PracticeSessionStore = PracticeSessionState &
  PracticeSessionActions;

export interface PracticeSessionDeps {
  readonly metronome: StoreApi<MetronomeStore>;
  readonly library: StoreApi<LibraryStore>;
  readonly persistence: PracticePersistence;
  readonly now: () => number;
  readonly newUuid: () => string;
  readonly every: (ms: number, tick: () => void) => () => void;
}

function contextOf(state: LibraryState): PracticeContext {
  const set = activeSetView(state.setlists, state.entries, state.loaded);
  const preset = loadedPresetOf(state);
  return {
    setlist: set === undefined ? null : { id: set.id, name: set.name },
    song:
      preset === undefined ? null : { uuid: preset.uuid, title: preset.name },
  };
}

function sameContext(a: PracticeContext, b: PracticeContext): boolean {
  return a.setlist?.id === b.setlist?.id && a.song?.uuid === b.song?.uuid;
}

export function practiceRecordOf(summary: PracticeSummary): NewPracticeSession {
  return {
    uuid: summary.uuid,
    startedAt: new Date(summary.startedAt),
    durationSeconds: Math.round(summary.playedMs / MS_PER_SECOND),
    avgBpm: summary.avgBpm,
    setlistId: summary.setlist?.id ?? null,
    songUuids: summary.songs.map((song) => song.uuid),
  };
}

function everySetInterval(ms: number, tick: () => void): () => void {
  const timer = setInterval(tick, ms);
  return () => {
    clearInterval(timer);
  };
}

export function createPracticeSessionStore(
  deps: PracticeSessionDeps,
): StoreApi<PracticeSessionStore> {
  const { metronome, library, now } = deps;
  const saving = new Map<string, Promise<void>>();
  const discardedWhileSaving = new Set<string>();

  const store = createStore<PracticeSessionStore>((set, get) => {
    const dequeue = (uuid: string) => {
      set({
        pending: get().pending.filter((summary) => summary.uuid !== uuid),
      });
    };
    const write = (summary: PracticeSummary) =>
      Promise.resolve()
        .then(() => deps.persistence.insert(practiceRecordOf(summary)))
        .then(
          () => {
            dequeue(summary.uuid);
          },
          (error: unknown) => {
            if (!discardedWhileSaving.has(summary.uuid)) throw error;
            dequeue(summary.uuid);
          },
        )
        .finally(() => {
          saving.delete(summary.uuid);
          discardedWhileSaving.delete(summary.uuid);
        });
    return {
      session: null,
      pending: [],
      endSession: () => {
        const { session, pending } = get();
        if (session === null) return null;
        const at = now();
        const metronomeState = metronome.getState();
        const bpm = metronomeState.readTempo();
        const ended = endPracticeSession(session, at, bpm);
        const summary = ended.playedMs >= MIN_SAVED_PLAYED_MS ? ended : null;
        set({
          pending: summary === null ? pending : [summary, ...pending],
          session: metronomeState.running
            ? startPracticeSession(deps.newUuid(), at, bpm, session.context)
            : null,
        });
        return summary;
      },
      saveSession: () => {
        const latest = get().pending[0];
        if (latest === undefined) return Promise.resolve();
        const inFlight = saving.get(latest.uuid);
        if (inFlight !== undefined) return inFlight;
        const written = write(latest);
        saving.set(latest.uuid, written);
        return written;
      },
      discardSession: () => {
        const latest = get().pending[0];
        if (latest === undefined) return;
        if (saving.has(latest.uuid)) discardedWhileSaving.add(latest.uuid);
        else dequeue(latest.uuid);
      },
    };
  });

  const update = (next: (session: PracticeSession) => PracticeSession) => {
    const { session } = store.getState();
    if (session !== null) store.setState({ session: next(session) });
  };

  const sampleTempo = () => {
    const bpm = metronome.getState().readTempo();
    update((session) => practiceSessionAfterTempo(session, now(), bpm));
  };

  let stopSampling: (() => void) | null = null;
  const onRunning = (state: MetronomeStore) => {
    const at = now();
    stopSampling?.();
    stopSampling = null;
    if (!state.running) {
      update((session) =>
        practiceSessionAfterRunning(session, false, at, state.bpm),
      );
      return;
    }
    const { session } = store.getState();
    store.setState({
      session:
        session === null
          ? startPracticeSession(
              deps.newUuid(),
              at,
              state.bpm,
              contextOf(library.getState()),
            )
          : practiceSessionAfterRunning(session, true, at, state.bpm),
    });
    stopSampling = deps.every(PRACTICE_TEMPO_SAMPLE_MS, sampleTempo);
  };

  metronome.subscribe((state, previous) => {
    if (state.running !== previous.running) onRunning(state);
    else if (state.bpm !== previous.bpm)
      update((session) => practiceSessionAfterTempo(session, now(), state.bpm));
  });

  library.subscribe((state) => {
    const context = contextOf(state);
    const { session } = store.getState();
    if (session === null || sameContext(session.context, context)) return;
    update((current) => practiceSessionAfterContext(current, context, now()));
  });

  return store;
}

let configured: StoreApi<PracticeSessionStore> | undefined;

const unconfigured: PracticePersistence = {
  insert: () =>
    Promise.reject(new Error('Practice persistence is not configured')),
};

function defaultDeps(persistence: PracticePersistence): PracticeSessionDeps {
  return {
    metronome: metronomeStore,
    library: libraryStore,
    persistence,
    now: () => Date.now(),
    newUuid: () => crypto.randomUUID(),
    every: everySetInterval,
  };
}

export function configurePracticeSessions(
  persistence: PracticePersistence,
): void {
  if (configured !== undefined)
    throw new Error(
      'Practice session store already exists; configure persistence before first use',
    );
  configured = createPracticeSessionStore(defaultDeps(persistence));
}

export function getPracticeSessionStore(): StoreApi<PracticeSessionStore> {
  configured ??= createPracticeSessionStore(defaultDeps(unconfigured));
  return configured;
}
