import { boottimeNowMs, type MediaSessionSnapshot } from '@kitbag/core-native';
import {
  extrapolatedPositionMs,
  getMediaSessionsStore,
  getPlayAlongStore,
  tempoLadderStore,
  useMediaSessions,
  useTempoLadder,
  type PlayAlongStore,
} from '@kitbag/core-state';
import { useEffect, useState, useSyncExternalStore } from 'react';

const TICK_MS = 1000;

export function usePlayAlong<T>(selector: (state: PlayAlongStore) => T): T {
  const store = getPlayAlongStore();
  return useSyncExternalStore(store.subscribe, () =>
    selector(store.getState()),
  );
}

export function useFollowedSession(): MediaSessionSnapshot | undefined {
  const lockedId = usePlayAlong((s) => s.lock?.sessionId);
  const chosenId = useMediaSessions((s) => s.chosenId);
  const wantedId = lockedId ?? chosenId;
  return useMediaSessions((s) =>
    s.sessions.find((session) => session.sessionId === wantedId),
  );
}

function releaseWhenUnlocked(stop: () => void): void {
  const playAlong = getPlayAlongStore();
  if (playAlong.getState().lock === undefined) {
    stop();
    return;
  }
  const unsubscribe = playAlong.subscribe((state) => {
    if (state.lock !== undefined) return;
    unsubscribe();
    stop();
  });
}

// A lock follows the song after the screen closes, so the sessions stay watched.
export function useSessionWatch(): void {
  useEffect(() => {
    const stop = getMediaSessionsStore().getState().watch();
    return () => {
      releaseWhenUnlocked(stop);
    };
  }, []);
}

export function useSongTempo(session: MediaSessionSnapshot | undefined): void {
  const title = session?.title ?? null;
  const artist = session?.artist ?? '';
  const bpm = useTempoLadder((s) => s.bpm);

  useEffect(() => {
    if (title !== null)
      void tempoLadderStore.getState().lookUp({ title, artist });
  }, [title, artist]);

  useEffect(() => {
    if (bpm !== null) getPlayAlongStore().getState().setBpm(bpm);
  }, [bpm]);
}

export function useSongPositionMs(
  session: MediaSessionSnapshot | undefined,
): number | null {
  const [now, setNow] = useState(boottimeNowMs);
  const playing = session?.playing === true;

  useEffect(() => {
    setNow(boottimeNowMs());
    if (!playing) return;
    const tick = setInterval(() => {
      setNow(boottimeNowMs());
    }, TICK_MS);
    return () => {
      clearInterval(tick);
    };
  }, [playing, session?.positionUpdatedAtMs]);

  return session === undefined ? null : extrapolatedPositionMs(session, now);
}
