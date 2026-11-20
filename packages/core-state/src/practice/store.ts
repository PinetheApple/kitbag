import {
  loggedSettingsOf,
  MS_PER_SECOND,
  type NewPracticeSession,
} from '@kitbag/core-db';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { activeSetView } from '../library/activeSet.ts';
import {
  libraryStore,
  loadedPresetOf,
  type LibraryState,
  type LibraryStore,
} from '../library/store.ts';
import { presetFromMetronome } from '../library/presetMapping.ts';
import { roundToEngineBpm } from '../metronome/config.ts';
import {
  metronomeStore,
  type MetronomeConfig,
  type MetronomeStore,
} from '../metronome/store.ts';
import {
  endPracticeSession,
  MIN_SAVED_PLAYED_MS,
  PRACTICE_TEMPO_SAMPLE_MS,
  practiceSessionAfterContext,
  practiceSessionAfterPause,
  practiceSessionAfterPlay,
  practiceSessionAfterSettings,
  practiceSessionAfterTempo,
  practiceSessionAfterTempoChange,
  startPracticeSession,
  type PracticeContext,
  type PracticeRecording,
  type PracticeSession,
} from './session.ts';
import type { StretchSetup } from './stretch.ts';

export interface PracticePersistence {
  readonly insert: (session: NewPracticeSession) => Promise<void>;
}

export interface PracticeSessionState {
  readonly session: PracticeSession | null;
  readonly pending: readonly PracticeRecording[];
}

export interface PracticeSessionActions {
  endSession: () => PracticeRecording | null;
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

function stageOf(state: LibraryState): PracticeContext['setlist'] {
  const set = activeSetView(state.setlists, state.entries, state.loaded);
  const summary = state.setlists.find((s) => s.setlist.id === set?.id);
  if (set === undefined || summary === undefined) return null;
  return {
    id: set.id,
    uuid: summary.setlist.uuid,
    name: set.name,
    position: set.position ?? null,
    itemId: state.loaded?.itemId ?? null,
  };
}

function contextOf(state: LibraryState): PracticeContext {
  const preset = loadedPresetOf(state);
  return {
    setlist: stageOf(state),
    song:
      preset === undefined ? null : { uuid: preset.uuid, title: preset.name },
  };
}

function sameContext(a: PracticeContext, b: PracticeContext): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function setupOf(config: MetronomeConfig): StretchSetup {
  const { bars, distinct, sound } = config.countIn;
  return {
    settings: loggedSettingsOf(presetFromMetronome(config)),
    countIn: { bars, distinct, sound },
  };
}

function settingsKey(config: MetronomeConfig): string {
  const settings = { ...presetFromMetronome(config), bpm: null };
  return JSON.stringify([settings, config.countIn]);
}

function isUserTempoChange(
  state: MetronomeConfig,
  previous: MetronomeConfig,
): boolean {
  return (
    !state.ramp.enabled &&
    roundToEngineBpm(state.bpm) !== roundToEngineBpm(previous.bpm)
  );
}

export function practiceRecordOf(
  recording: PracticeRecording,
): NewPracticeSession {
  return {
    uuid: recording.uuid,
    startedAt: new Date(recording.startedAt),
    durationSeconds: Math.round(recording.playedMs / MS_PER_SECOND),
    avgBpm: recording.avgBpm,
    setlistId: recording.setlist?.id ?? null,
    setlistName: recording.setlist?.name ?? null,
    songUuids: recording.songs.map((song) => song.uuid),
    log: recording.log,
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
    const write = (summary: PracticeRecording) =>
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
            ? startPracticeSession(
                deps.newUuid(),
                at,
                bpm,
                session.context,
                setupOf(metronomeState),
              )
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
      update((session) => practiceSessionAfterPause(session, at, state.bpm));
      return;
    }
    const { session } = store.getState();
    const setup = setupOf(state);
    store.setState({
      session:
        session === null
          ? startPracticeSession(
              deps.newUuid(),
              at,
              state.bpm,
              contextOf(library.getState()),
              setup,
            )
          : practiceSessionAfterPlay(session, at, state.bpm, setup),
    });
    stopSampling = deps.every(PRACTICE_TEMPO_SAMPLE_MS, sampleTempo);
  };

  const onChange = (state: MetronomeStore, previous: MetronomeStore) => {
    const at = now();
    const { bpm } = state;
    if (settingsKey(state) !== settingsKey(previous))
      update((s) => practiceSessionAfterSettings(s, at, bpm, setupOf(state)));
    else if (isUserTempoChange(state, previous))
      update((s) =>
        practiceSessionAfterTempoChange(s, at, bpm, setupOf(state)),
      );
    else if (bpm !== previous.bpm)
      update((s) => practiceSessionAfterTempo(s, at, bpm));
  };

  metronome.subscribe((state, previous) => {
    if (state.running !== previous.running) onRunning(state);
    else onChange(state, previous);
  });

  library.subscribe((state) => {
    const context = contextOf(state);
    const { session } = store.getState();
    if (session === null || sameContext(session.context, context)) return;
    const live = metronome.getState();
    const bpm = live.readTempo();
    update((current) =>
      practiceSessionAfterContext(current, context, now(), bpm, setupOf(live)),
    );
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
