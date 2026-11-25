import type { QueuedSong } from '@kitbag/core-db';
import type { StoreApi } from 'zustand/vanilla';

import { activeSetlistOf } from './setlistPosition.ts';
import { isPresetEntry, type SetlistEntry } from './snapshot.ts';
import type {
  DiscardedChanges,
  LibraryState,
  LibraryStore,
  LoadedSong,
} from './store.ts';

export interface SetlistSession {
  readonly setlistId: number;
  readonly skipped: readonly number[];
}

export interface SessionState {
  readonly session: SetlistSession | null;
  readonly loaded: LoadedSong | null;
  readonly played: readonly number[];
  readonly discarded: DiscardedChanges | null;
}

export interface LeftSetlist {
  readonly setlistId: number;
  readonly setlistName: string;
  readonly restores: SessionState;
  readonly leftAs: Pick<SessionState, 'session' | 'loaded'>;
}

export interface SetlistSessionActions {
  leaveSetlist: () => Promise<LeftSetlist | null>;
  rejoinSetlist: (left: LeftSetlist) => Promise<boolean>;
  endSetlistSession: (reopenedStemSetId?: number) => void;
  endListeningSession: () => void;
  skipSetlistEntry: (itemId: number) => void;
  dismissEndedSetlist: () => void;
}

export interface SessionWiring {
  readonly pin: (setlistId: number) => Promise<void>;
  readonly leave: () => Promise<void>;
}

type SetState = StoreApi<LibraryStore>['setState'];
type Get = StoreApi<LibraryStore>['getState'];

export function sessionStateOf({
  session,
  loaded,
  played,
  discarded,
}: SessionState): SessionState {
  return { session, loaded, played, discarded };
}

function leftSetlistOf(
  state: LibraryState,
  setlistId: number,
  restores: SessionState,
): LeftSetlist {
  const { setlists, session, loaded } = state;
  const setlistName =
    setlists.find((summary) => summary.setlist.id === setlistId)?.setlist
      .name ?? '';
  return { setlistId, setlistName, restores, leftAs: { session, loaded } };
}

function playsFromSession(
  { session, loaded }: SessionState,
  stemSetId: number,
): boolean {
  return (
    session !== null &&
    loaded?.presetId === null &&
    loaded.stemSetId === stemSetId &&
    loaded.setlistId === session.setlistId
  );
}

function entryIs(song: QueuedSong) {
  return (entry: SetlistEntry) =>
    isPresetEntry(entry)
      ? song.kind === 'song' && entry.preset.librarySongId === song.id
      : song.kind === 'stems' && entry.stemSetId === song.id;
}

export function isSessionEntry(
  { session, entries }: Pick<LibraryState, 'session' | 'entries'>,
  song: QueuedSong,
): boolean {
  if (session === null) return false;
  return (entries[session.setlistId] ?? []).some(entryIs(song));
}

export function startSession(
  set: SetState,
  get: Get,
  setlistId: number,
  before: SessionState,
) {
  const { session } = get();
  if (session?.setlistId === setlistId) return;
  set({ session: { setlistId, skipped: [] } });
  if (session !== null)
    set({ endedSetlist: leftSetlistOf(get(), session.setlistId, before) });
}

export function setlistSessionActions(
  set: SetState,
  get: Get,
  { pin, leave }: SessionWiring,
): SetlistSessionActions {
  return {
    leaveSetlist: async () => {
      const before = sessionStateOf(get());
      const setlistId =
        before.session?.setlistId ??
        activeSetlistOf(get().setlists)?.setlist.id;
      await leave();
      return setlistId === undefined
        ? null
        : leftSetlistOf(get(), setlistId, before);
    },
    rejoinSetlist: async (left: LeftSetlist) => {
      const { session, loaded } = get();
      if (session !== left.leftAs.session || loaded !== left.leftAs.loaded)
        return false;
      set({ ...left.restores, endedSetlist: null });
      await pin(left.setlistId);
      return true;
    },
    endSetlistSession: (reopenedStemSetId?: number) => {
      const state = get();
      const { session } = state;
      if (session === null) return;
      if (
        reopenedStemSetId !== undefined &&
        playsFromSession(state, reopenedStemSetId)
      )
        return;
      const before = sessionStateOf(state);
      set({ session: null });
      set({ endedSetlist: leftSetlistOf(get(), session.setlistId, before) });
    },
    endListeningSession: () => {
      set({ session: null });
    },
    skipSetlistEntry: (itemId: number) => {
      const { session } = get();
      if (session === null || session.skipped.includes(itemId)) return;
      set({ session: { ...session, skipped: [...session.skipped, itemId] } });
    },
    dismissEndedSetlist: () => {
      set({ endedSetlist: null });
    },
  };
}
