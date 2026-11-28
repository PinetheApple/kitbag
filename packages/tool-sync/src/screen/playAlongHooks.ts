import { boottimeNowMs, type MediaSessionSnapshot } from '@kitbag/core-native';
import {
  BEAT_SOURCE,
  extrapolatedPositionMs,
  getMediaSessionsStore,
  getPlayAlongStore,
  useMediaSessions,
  useTempoLadder,
  type PlayAlongStore,
} from '@kitbag/core-state';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { tempoLine, type TempoLine } from '../logic/tempoLine.ts';

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

export function releaseWhenUnlocked(stop: () => void): void {
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

export function useSessionWatchWhileLocked(): void {
  useEffect(() => {
    const stop = getMediaSessionsStore().getState().watch();
    return () => {
      releaseWhenUnlocked(stop);
    };
  }, []);
}

export function useLibraryWatch(): void {
  useEffect(() => getPlayAlongStore().getState().watchLibrary(), []);
}

export function msToNextSecond(
  session: MediaSessionSnapshot,
  nowMs: number,
): number {
  const positionMs = extrapolatedPositionMs(session, nowMs) ?? 0;
  const songMsLeft = TICK_MS - (((positionMs % TICK_MS) + TICK_MS) % TICK_MS);
  return session.speed > 0 ? songMsLeft / session.speed : TICK_MS;
}

export function useTempoLine(): {
  readonly bpm: number | null;
  readonly line: TempoLine;
} {
  const bpm = usePlayAlong((s) => s.bpm) ?? null;
  const offered = usePlayAlong((s) => s.offer !== undefined);
  const tapCount = usePlayAlong((s) =>
    s.lock?.tapped?.beatSource === BEAT_SOURCE.taps
      ? s.lock.tapped.keptTaps
      : null,
  );
  const source = useTempoLadder((s) => s.source);
  const tried = useTempoLadder((s) => s.tried);
  const looking = useTempoLadder((s) => s.looking);
  return useMemo(
    () => ({
      bpm,
      line: tempoLine({ bpm, source, tried, looking, offered, tapCount }),
    }),
    [bpm, source, tried, looking, offered, tapCount],
  );
}

export function useSongPositionMs(
  session: MediaSessionSnapshot | undefined,
): number | null {
  const [now, setNow] = useState(boottimeNowMs);

  useEffect(() => {
    setNow(boottimeNowMs());
    if (session?.playing !== true) return;
    let tick: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      tick = setTimeout(
        () => {
          setNow(boottimeNowMs());
          schedule();
        },
        msToNextSecond(session, boottimeNowMs()),
      );
    };
    schedule();
    return () => {
      clearTimeout(tick);
    };
  }, [session]);

  return session === undefined ? null : extrapolatedPositionMs(session, now);
}
