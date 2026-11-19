import type { SavedPracticeSession } from '@kitbag/core-db';
import {
  getRepeatOverlay,
  repeatPlanOf,
  sessionLoadOf,
  sessionTimeline,
  useLibrary,
  usePracticeHistory,
} from '@kitbag/core-state';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { loadArgs } from './detailText.ts';

function useLibraryView() {
  const setlists = useLibrary((s) => s.setlists);
  const entries = useLibrary((s) => s.entries);
  const presets = useLibrary((s) => s.presets);
  return useMemo(
    () => ({ setlists, entries, presets }),
    [setlists, entries, presets],
  );
}

function useSession(uuid: string) {
  const getSession = usePracticeHistory((s) => s.getSession);
  const [session, setSession] = useState<SavedPracticeSession | null>(null);
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      let focused = true;
      setNow(new Date());
      getSession(uuid).then(
        (found) => {
          if (focused) setSession(found ?? null);
        },
        (error: unknown) => {
          console.warn('[kitbag] could not read the practice session', error);
        },
      );
      return () => {
        focused = false;
      };
    }, [getSession, uuid]),
  );
  return { session, now };
}

export function useSessionDetail(uuid: string, onLoaded: () => void) {
  const { session, now } = useSession(uuid);
  const library = useLibraryView();
  const loadSong = useLibrary((s) => s.loadSong);
  const overlay = getRepeatOverlay();
  const log = session?.log ?? null;
  const timeline = useMemo(
    () => (log === null ? null : sessionTimeline(log)),
    [log],
  );
  const plan = useMemo(
    () =>
      log === null || overlay === undefined ? null : repeatPlanOf(log, library),
    [log, overlay, library],
  );
  const load = useMemo(
    () =>
      session === null || log !== null ? null : sessionLoadOf(session, library),
    [session, log, library],
  );
  const songTitle = useCallback(
    (songUuid: string) =>
      library.presets.find((preset) => preset.uuid === songUuid)?.name,
    [library.presets],
  );
  const setlistSize = useCallback(
    (setlistUuid: string) =>
      library.setlists.find((s) => s.setlist.uuid === setlistUuid)?.songCount,
    [library.setlists],
  );
  const repeat = useCallback(() => {
    if (plan === null || overlay === undefined) return;
    overlay.start(plan).then(onLoaded, (error: unknown) => {
      console.warn('[kitbag] could not repeat the session', error);
    });
  }, [plan, overlay, onLoaded]);
  const loadSession = useCallback(() => {
    if (load === null) return;
    loadSong(...loadArgs(load)).then(onLoaded, (error: unknown) => {
      console.warn('[kitbag] could not load the session', error);
    });
  }, [load, loadSong, onLoaded]);
  return {
    session,
    now,
    timeline,
    plan,
    load,
    songTitle,
    setlistSize,
    repeat,
    loadSession,
  };
}
