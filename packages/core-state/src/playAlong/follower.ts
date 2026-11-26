import { MS_PER_SECOND } from '@kitbag/core-db';
import {
  PLAY_ALONG_CARD_ACTION,
  type MediaSessionSnapshot,
  type PlayAlongCardRequest,
  type PlayAlongCardShowState,
} from '@kitbag/core-native';

import type { StoreAccess } from '../configuredStore.ts';
import { engineGrid } from './engineGrid.ts';
import { LOCK_REFUSAL } from './lockOutcome.ts';
import type { PlayAlongPattern } from './pattern.ts';
import {
  barSeconds,
  engineSongSeconds,
  extrapolatedPositionMs,
} from './position.ts';
import type { PlayAlongRuntime } from './runtime.ts';
import type { PlayAlongSlot } from './slot.ts';
import type { PlayAlongLock, PlayAlongState, PlayAlongStore } from './store.ts';
import { cardOf, findSession, sameCard, sameTrack, trackOf } from './track.ts';

export const REANCHOR_INTERVAL_MS = 1500;
export const ANCHOR_RETRY_MS = 50;
export const SEEK_JUMP_MS = 1000;
export const SOURCE_GONE_HOLD_MS = 10_000;

type Access = StoreAccess<PlayAlongStore>;

interface AnchorPoint {
  readonly atMs: number;
  readonly songMs: number;
  readonly speed: number;
}

interface Follow {
  readonly leave: () => void;
  seen: MediaSessionSnapshot;
  card: PlayAlongCardShowState | undefined;
  lastAnchor: AnchorPoint | undefined;
  grace: ReturnType<typeof setTimeout> | undefined;
  retry: ReturnType<typeof setTimeout> | undefined;
}

export const NO_LOCK_STATE = {
  lock: undefined,
  songAheadOfClickMs: undefined,
  lastAnchorAtBoottimeMs: undefined,
  sourceGoneAtBoottimeMs: undefined,
} as const satisfies Partial<PlayAlongState>;

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

export function follower(
  runtime: PlayAlongRuntime,
  { getState, setState }: Access,
  slot: PlayAlongSlot,
  unlocked: () => void,
) {
  let follow: Follow | undefined;

  const grids = engineGrid(runtime.commands);

  const gridRejected = () => {
    unlock();
    setState({ lastRefusal: LOCK_REFUSAL.gridRejected });
  };

  const syncGrid = (lock: PlayAlongLock) => {
    if (lock.grid === undefined) grids.drop();
    else if (!grids.holds(lock.grid))
      grids.send(lock.grid, { accepted: anchor, rejected: gridRejected });
  };

  const placeClick = (
    lock: PlayAlongLock,
    songMs: number,
    frame: number,
    speed: number,
  ): boolean => {
    if (lock.grid !== undefined) return grids.anchor(songMs, frame, speed);
    const click = clickPlacement(lock, getState().pattern, songMs, speed);
    runtime.commands.metronomeAnchorExternal(click.songSec, frame, click.bpm);
    return true;
  };

  const retrySoon = (current: Follow) => {
    if (current.retry !== undefined) return;
    current.retry = setTimeout(() => {
      current.retry = undefined;
      if (follow === current) anchor();
    }, ANCHOR_RETRY_MS);
  };

  const anchor = () => {
    const current = follow;
    const { lock } = getState();
    if (current === undefined || lock === undefined) return;
    syncGrid(lock);
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
    if (!placeClick(lock, songMs, frame, seen.speed)) return;
    const songAheadOfClickMs = correctionMs(current.lastAnchor, now, songMs);
    current.lastAnchor = { atMs: now, songMs, speed: seen.speed };
    setState({ songAheadOfClickMs, lastAnchorAtBoottimeMs: now });
  };

  const showCard = (current: Follow) => {
    const card = cardOf(current.seen);
    if (sameCard(current.card, card)) return;
    current.card = card;
    runtime.commands.playAlongCardShow(card);
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
    grids.drop();
    ending.leave();
    setState(NO_LOCK_STATE);
    unlocked();
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
    showCard(current);
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

  const onCardRequest = ({ action }: PlayAlongCardRequest) => {
    if (action === PLAY_ALONG_CARD_ACTION.stop) unlock();
    else getState().playPause();
  };

  const start = (seen: MediaSessionSnapshot): Follow => {
    slot.enter(unlock);
    const stopWatching = runtime.sessions().subscribe((state, previous) => {
      if (state.sessions !== previous.sessions) onSessions(state.sessions);
    });
    const stopCard = runtime.onCardRequest(onCardRequest);
    runtime.playbackStarted();
    const ticker = setInterval(anchor, REANCHOR_INTERVAL_MS);
    return {
      seen,
      card: undefined,
      lastAnchor: undefined,
      grace: undefined,
      retry: undefined,
      leave: () => {
        clearInterval(ticker);
        stopCard();
        runtime.commands.playAlongCardHide();
        stopWatching();
        slot.leave();
      },
    };
  };

  const lockOn = (seen: MediaSessionSnapshot, lock: PlayAlongLock) => {
    follow ??= start(seen);
    follow.seen = seen;
    follow.lastAnchor = undefined;
    sourceBack(follow);
    showCard(follow);
    setState({
      lock,
      songAheadOfClickMs: undefined,
      offer: undefined,
      lastRefusal: undefined,
    });
    runtime.sessions().getState().pick(seen.sessionId);
    anchor();
  };

  return { anchor, unlock, lockOn };
}
