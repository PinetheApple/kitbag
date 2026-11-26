import { MS_PER_SECOND } from '@kitbag/core-db';
import type {
  KB_ACCENT,
  MediaSessionSnapshot,
  MediaSessionStep,
} from '@kitbag/core-native';

import { configuredStore, type StoreAccess } from '../configuredStore.ts';
import { BPM_BOUNDS, clamp } from '../metronome/config.ts';
import {
  enterPlayAlongSlot,
  initialPattern,
  withAccents,
  withMeter,
  withSounds,
  withSubdivision,
  withVolume,
  type PatternEdit,
  type PlayAlongPattern,
} from './pattern.ts';
import {
  barSeconds,
  engineSongSeconds,
  extrapolatedPositionMs,
} from './position.ts';
import { nativePlayAlongRuntime, type PlayAlongRuntime } from './runtime.ts';

export const REANCHOR_INTERVAL_MS = 1500;
export const ANCHOR_RETRY_MS = 50;
export const SEEK_JUMP_MS = 1000;
export const SOURCE_GONE_HOLD_MS = 10_000;

export const TAP_REFUSAL = {
  noBpm: 'no-bpm',
  noSession: 'no-session',
  paused: 'paused',
  unknownPosition: 'unknown-position',
} as const;

export type TapRefusal = (typeof TAP_REFUSAL)[keyof typeof TAP_REFUSAL];

export type TapOutcome =
  | { readonly locked: true }
  | { readonly locked: false; readonly reason: TapRefusal };

export type PlayAlongTrack = Pick<
  MediaSessionSnapshot,
  'title' | 'artist' | 'durationMs'
>;

export interface PlayAlongLock {
  readonly sessionId: string;
  readonly track: PlayAlongTrack;
  readonly downbeatSec: number;
  readonly bpm: number;
  readonly lockedAtBoottimeMs: number;
}

export interface PlayAlongState {
  readonly pattern: PlayAlongPattern;
  readonly bpm: number | undefined;
  readonly lock: PlayAlongLock | undefined;
  readonly songAheadOfClickMs: number | undefined;
  readonly lastAnchorAtBoottimeMs: number | undefined;
  readonly sourceGoneAtBoottimeMs: number | undefined;
}

export interface PlayAlongActions {
  readonly setBpm: (bpm: number) => void;
  readonly tap: (atBoottimeMs: number) => TapOutcome;
  readonly unlock: () => void;
  readonly setBeats: (beatsPerBar: number, denominator: number) => void;
  readonly setSubdivision: (subdivision: number) => void;
  readonly setAccents: (accents: readonly KB_ACCENT[]) => void;
  readonly setSounds: (normal: number, accent: number) => void;
  readonly setVolume: (volume: number) => void;
  readonly previous: () => void;
  readonly playPause: () => void;
  readonly next: () => void;
}

export type PlayAlongStore = PlayAlongState & PlayAlongActions;

type Access = StoreAccess<PlayAlongStore>;

interface AnchorPoint {
  readonly atMs: number;
  readonly songMs: number;
  readonly speed: number;
}

interface Follow {
  readonly leave: () => void;
  seen: MediaSessionSnapshot;
  lastAnchor: AnchorPoint | undefined;
  grace: ReturnType<typeof setTimeout> | undefined;
  retry: ReturnType<typeof setTimeout> | undefined;
}

const LOCKED_OUTCOME: TapOutcome = { locked: true };

const refused = (reason: TapRefusal): TapOutcome => ({ locked: false, reason });

const NO_LOCK_STATE = {
  lock: undefined,
  songAheadOfClickMs: undefined,
  lastAnchorAtBoottimeMs: undefined,
  sourceGoneAtBoottimeMs: undefined,
} as const satisfies Partial<PlayAlongState>;

const findSession = (
  sessions: readonly MediaSessionSnapshot[],
  sessionId: string | undefined,
) => sessions.find((session) => session.sessionId === sessionId);

const trackOf = ({
  title,
  artist,
  durationMs,
}: MediaSessionSnapshot): PlayAlongTrack => ({ title, artist, durationMs });

const sameTrack = (track: PlayAlongTrack, seen: MediaSessionSnapshot) =>
  track.title === seen.title &&
  track.artist === seen.artist &&
  (track.durationMs === null || track.durationMs === seen.durationMs);

function correctionMs(
  previous: AnchorPoint | undefined,
  atMs: number,
  songMs: number,
): number {
  if (previous === undefined) return 0;
  const implied = previous.songMs + (atMs - previous.atMs) * previous.speed;
  const correction = songMs - implied;
  return Math.abs(correction) > SEEK_JUMP_MS ? 0 : correction;
}

function clickPlacement(
  lock: PlayAlongLock,
  pattern: PlayAlongPattern,
  songMs: number,
  speed: number,
) {
  const bar = barSeconds(lock.bpm, pattern.beatsPerBar, pattern.denominator);
  const songSec = songMs / MS_PER_SECOND;
  return {
    songSec: engineSongSeconds(songSec, lock.downbeatSec, bar) / speed,
    bpm: lock.bpm * speed,
  };
}

function follower(runtime: PlayAlongRuntime, { getState, setState }: Access) {
  let follow: Follow | undefined;

  const retrySoon = (current: Follow) => {
    if (current.retry !== undefined) return;
    current.retry = setTimeout(() => {
      current.retry = undefined;
      if (follow === current) anchor();
    }, ANCHOR_RETRY_MS);
  };

  const anchor = () => {
    const current = follow;
    const { lock, pattern } = getState();
    if (current === undefined || lock === undefined) return;
    const { seen } = current;
    if (current.grace !== undefined || !seen.playing || seen.speed <= 0) return;
    const now = runtime.boottimeNowMs();
    const songMs = extrapolatedPositionMs(seen, now);
    if (songMs === null) return;
    const frame = runtime.engineFrameAtBoottimeMs(now);
    if (frame === null) {
      retrySoon(current);
      return;
    }
    const click = clickPlacement(lock, pattern, songMs, seen.speed);
    runtime.commands.metronomeAnchorExternal(click.songSec, frame, click.bpm);
    const songAheadOfClickMs = correctionMs(current.lastAnchor, now, songMs);
    current.lastAnchor = { atMs: now, songMs, speed: seen.speed };
    setState({ songAheadOfClickMs, lastAnchorAtBoottimeMs: now });
  };

  const silence = (current: Follow) => {
    if (current.lastAnchor === undefined) return;
    current.lastAnchor = undefined;
    runtime.commands.metronomePause();
  };

  const unlock = () => {
    const ending = follow;
    if (ending === undefined) return;
    follow = undefined;
    clearTimeout(ending.grace);
    clearTimeout(ending.retry);
    ending.leave();
    setState(NO_LOCK_STATE);
  };

  const sourceGone = (current: Follow) => {
    if (current.grace !== undefined) return;
    silence(current);
    current.grace = setTimeout(unlock, SOURCE_GONE_HOLD_MS);
    setState({ sourceGoneAtBoottimeMs: runtime.boottimeNowMs() });
  };

  const sourceBack = (current: Follow) => {
    if (current.grace === undefined) return;
    clearTimeout(current.grace);
    current.grace = undefined;
    setState({ sourceGoneAtBoottimeMs: undefined });
  };

  const followReport = (current: Follow, seen: MediaSessionSnapshot) => {
    current.seen = seen;
    if (seen.playing) anchor();
    else silence(current);
  };

  const onSessions = (sessions: readonly MediaSessionSnapshot[]) => {
    const { lock } = getState();
    const current = follow;
    if (current === undefined || lock === undefined) return;
    const seen = findSession(sessions, lock.sessionId);
    if (seen === undefined) {
      sourceGone(current);
      return;
    }
    sourceBack(current);
    if (!sameTrack(lock.track, seen)) {
      unlock();
      return;
    }
    if (lock.track.durationMs !== seen.durationMs)
      setState({ lock: { ...lock, track: trackOf(seen) } });
    followReport(current, seen);
  };

  const start = (seen: MediaSessionSnapshot): Follow => {
    const leaveSlot = enterPlayAlongSlot(
      runtime.commands,
      getState().pattern,
      runtime.latencyOffsetMs(),
      runtime.yieldStandalone,
    );
    const stopWatching = runtime.sessions().subscribe((state, previous) => {
      if (state.sessions !== previous.sessions) onSessions(state.sessions);
    });
    const stopStarts = runtime.onClickStarting(unlock);
    const ticker = setInterval(anchor, REANCHOR_INTERVAL_MS);
    return {
      seen,
      lastAnchor: undefined,
      grace: undefined,
      retry: undefined,
      leave: () => {
        clearInterval(ticker);
        stopStarts();
        stopWatching();
        leaveSlot();
      },
    };
  };

  const lockOn = (seen: MediaSessionSnapshot, lock: PlayAlongLock) => {
    follow ??= start(seen);
    follow.seen = seen;
    follow.lastAnchor = undefined;
    sourceBack(follow);
    setState({ lock, songAheadOfClickMs: undefined });
    runtime.sessions().getState().pick(seen.sessionId);
    anchor();
  };

  return { anchor, unlock, lockOn, following: () => follow !== undefined };
}

function transport(runtime: PlayAlongRuntime, { getState }: Access) {
  const target = () => {
    const { sessions, chosenId } = runtime.sessions().getState();
    return findSession(sessions, getState().lock?.sessionId ?? chosenId);
  };
  const send = (step: MediaSessionStep) => {
    const session = target();
    if (session !== undefined)
      runtime.sessionCommand(session.sessionId, { type: step });
  };
  return {
    previous: () => {
      send('previous');
    },
    next: () => {
      send('next');
    },
    playPause: () => {
      send(target()?.playing === true ? 'pause' : 'play');
    },
  };
}

function patternSetters(
  runtime: PlayAlongRuntime,
  { getState, setState }: Access,
  follow: ReturnType<typeof follower>,
) {
  const apply = (edit: PatternEdit | undefined) => {
    if (edit === undefined) return;
    setState({ pattern: edit.pattern });
    if (follow.following()) edit.send(runtime.commands);
  };
  const pattern = () => getState().pattern;
  return {
    setBeats: (beatsPerBar: number, denominator: number) => {
      apply(withMeter(pattern(), beatsPerBar, denominator));
      follow.anchor();
    },
    setSubdivision: (subdivision: number) => {
      apply(withSubdivision(pattern(), subdivision));
    },
    setAccents: (accents: readonly KB_ACCENT[]) => {
      apply(withAccents(pattern(), accents));
    },
    setSounds: (normal: number, accent: number) => {
      apply(withSounds(pattern(), normal, accent));
    },
    setVolume: (volume: number) => {
      apply(withVolume(pattern(), volume));
    },
  };
}

function tapAction(
  runtime: PlayAlongRuntime,
  { getState }: Access,
  follow: ReturnType<typeof follower>,
) {
  return (atBoottimeMs: number): TapOutcome => {
    const { bpm } = getState();
    if (bpm === undefined) return refused(TAP_REFUSAL.noBpm);
    const { sessions, chosenId } = runtime.sessions().getState();
    const seen = findSession(sessions, chosenId);
    if (seen === undefined) return refused(TAP_REFUSAL.noSession);
    if (!seen.playing) return refused(TAP_REFUSAL.paused);
    const songMs = extrapolatedPositionMs(seen, atBoottimeMs);
    if (songMs === null) return refused(TAP_REFUSAL.unknownPosition);
    follow.lockOn(seen, {
      sessionId: seen.sessionId,
      track: trackOf(seen),
      downbeatSec: songMs / MS_PER_SECOND,
      bpm,
      lockedAtBoottimeMs: atBoottimeMs,
    });
    return LOCKED_OUTCOME;
  };
}

const playAlong = configuredStore<PlayAlongRuntime, PlayAlongStore>(
  'Play along',
  nativePlayAlongRuntime,
  (runtime, access) => {
    const follow = follower(runtime, access);
    return {
      pattern: initialPattern(),
      bpm: undefined,
      ...NO_LOCK_STATE,
      setBpm: (bpm) => {
        if (!Number.isFinite(bpm)) return;
        const next = clamp(bpm, BPM_BOUNDS.min, BPM_BOUNDS.max);
        const { lock } = access.getState();
        access.setState({ bpm: next, lock: lock && { ...lock, bpm: next } });
        follow.anchor();
      },
      tap: tapAction(runtime, access, follow),
      unlock: follow.unlock,
      ...patternSetters(runtime, access, follow),
      ...transport(runtime, access),
    };
  },
);

export const createPlayAlongStore = playAlong.create;
export const configurePlayAlong = playAlong.configure;
export const getPlayAlongStore = playAlong.get;
