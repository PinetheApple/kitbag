import type { MediaSessionSnapshot } from '@kitbag/core-native';

import type { StoreAccess } from '../configuredStore.ts';
import type { LibraryMatch } from '../tempoLadder/libraryMatch.ts';
import { sameSong } from '../tempoLadder/store.ts';
import type { PlayAlongRuntime } from './runtime.ts';
import type { LockOutcome } from './lockOutcome.ts';
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

type OfferAccess = StoreAccess<
  LibraryOfferState & { readonly lock: object | undefined }
>;

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

  const offerNow = (): LibraryOffer | undefined => {
    const seen = chosenSession(runtime);
    if (dismissed !== undefined && !(seen && isOfferFor(dismissed, seen)))
      dismissed = undefined;
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
    const offer = offerNow();
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
