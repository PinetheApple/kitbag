import type { MediaSessionSnapshot } from '@kitbag/core-native';

import type { StoreAccess } from '../configuredStore.ts';
import { BPM_BOUNDS, clamp } from '../metronome/config.ts';
import { NO_GRID } from '../songPlayer/songGrid.ts';
import type { LibraryMatch } from '../tempoLadder/libraryMatch.ts';
import { sameSong } from '../tempoLadder/store.ts';
import { firstDownbeatSec } from './libraryGrid.ts';
import type { LockedView } from './lockedView.ts';
import { gridPhase } from './phase.ts';
import {
  LOCK_REFUSAL,
  LOCKED_OUTCOME,
  refused,
  type LockOutcome,
} from './lockOutcome.ts';
import type { PlayAlongRuntime } from './runtime.ts';
import type { PlayAlongLock, PlayAlongStore } from './store.ts';
import {
  findSession,
  sameTrack,
  songOf,
  trackOf,
  type PlayAlongTrack,
} from './track.ts';

export interface LibraryOffer {
  readonly sessionId: string;
  readonly track: PlayAlongTrack;
  readonly match: LibraryMatch;
}

export interface LibraryOfferState {
  readonly offer: LibraryOffer | undefined;
}

export interface LibraryOfferActions {
  readonly watchLibrary: () => () => void;
  readonly acceptOffer: () => Promise<LockOutcome>;
  readonly dismissOffer: () => void;
}

type OfferAccess = StoreAccess<LibraryOfferState & LockedView>;

const isOfferFor = (offer: LibraryOffer, seen: MediaSessionSnapshot) =>
  offer.sessionId === seen.sessionId && sameTrack(offer.track, seen);

const sameMatch = (a: LibraryMatch, b: LibraryMatch) =>
  a.kind === b.kind && a.id === b.id && a.bpm === b.bpm;

function sameOffer(a: LibraryOffer | undefined, b: LibraryOffer | undefined) {
  if (a === undefined || b === undefined) return a === b;
  return (
    a.sessionId === b.sessionId &&
    a.track.title === b.track.title &&
    a.track.artist === b.track.artist &&
    a.track.durationMs === b.track.durationMs &&
    sameMatch(a.match, b.match)
  );
}

export function chosenSession(runtime: PlayAlongRuntime) {
  const { sessions, chosenId } = runtime.sessions().getState();
  return findSession(sessions, chosenId);
}

export function libraryOffers(
  runtime: PlayAlongRuntime,
  { getState, setState }: OfferAccess,
) {
  let dismissed: LibraryOffer | undefined;
  let lookedUp: MediaSessionSnapshot | undefined;

  const forgetStaleDismissal = (seen: MediaSessionSnapshot | undefined) => {
    if (dismissed !== undefined && !(seen && isOfferFor(dismissed, seen)))
      dismissed = undefined;
  };

  const offerNow = (
    seen: MediaSessionSnapshot | undefined,
  ): LibraryOffer | undefined => {
    if (seen === undefined || dismissed !== undefined) return undefined;
    if (getState().lock !== undefined) return undefined;
    const { track, libraryMatch } = runtime.ladder().getState();
    if (libraryMatch === null || !sameSong(track, songOf(seen)))
      return undefined;
    return {
      sessionId: seen.sessionId,
      track: trackOf(seen),
      match: libraryMatch,
    };
  };

  const refresh = () => {
    const seen = chosenSession(runtime);
    forgetStaleDismissal(seen);
    const offer = offerNow(seen);
    if (!sameOffer(offer, getState().offer)) setState({ offer });
  };

  const lookUp = () => {
    const seen = chosenSession(runtime);
    if (!seen?.title) return;
    if (lookedUp !== undefined && sameTrack(trackOf(lookedUp), seen)) return;
    lookedUp = seen;
    void runtime.ladder().getState().lookUp(songOf(seen));
  };

  const watchLibrary = () => {
    const stopSessions = runtime.sessions().subscribe(() => {
      lookUp();
      refresh();
    });
    const stopLadder = runtime.ladder().subscribe(refresh);
    lookedUp = undefined;
    lookUp();
    refresh();
    return () => {
      stopSessions();
      stopLadder();
    };
  };

  const dismissOffer = () => {
    dismissed = getState().offer;
    refresh();
  };

  return { refresh, watchLibrary, dismissOffer };
}

type LockOn = (seen: MediaSessionSnapshot, lock: PlayAlongLock) => void;

export function acceptAction(
  runtime: PlayAlongRuntime,
  { getState, setState }: StoreAccess<PlayAlongStore>,
  lockOn: LockOn,
) {
  return async (): Promise<LockOutcome> => {
    const { offer } = getState();
    if (offer === undefined) return refused(LOCK_REFUSAL.noOffer);
    const grid = await runtime.readGrid(offer.match).catch(() => NO_GRID);
    const seen = chosenSession(runtime);
    if (getState().offer !== offer || seen === undefined)
      return refused(LOCK_REFUSAL.noOffer);
    if (grid.beats.length === 0) return refused(LOCK_REFUSAL.noGrid);
    const bpm = clamp(offer.match.bpm, BPM_BOUNDS.min, BPM_BOUNDS.max);
    setState({ bpm });
    lockOn(seen, {
      sessionId: seen.sessionId,
      track: trackOf(seen),
      downbeatSec: firstDownbeatSec(grid),
      bpm,
      lockedAtBoottimeMs: runtime.boottimeNowMs(),
      grid,
      ...gridPhase(grid),
    });
    return LOCKED_OUTCOME;
  };
}
