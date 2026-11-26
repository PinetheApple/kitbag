import { isGridMeter, type SongPreset } from '@kitbag/core-db';
import type { MediaSessionSnapshot } from '@kitbag/core-native';

import type { StoreAccess } from '../configuredStore.ts';
import { BPM_BOUNDS, clamp } from '../metronome/config.ts';
import { NO_GRID } from '../songPlayer/songGrid.ts';
import {
  overrideDownbeats,
  type DetectedGrid,
} from '../stemPlayer/meterOverride.ts';
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
import {
  identityOf,
  presetForTrack,
  sameIdentity,
  type TrackIdentity,
} from './presetLookup.ts';
import type { PlayAlongRuntime } from './runtime.ts';
import type { PlayAlongLock, PlayAlongStore } from './store.ts';
import {
  findSession,
  sameTrack,
  songOf,
  trackOf,
  type PlayAlongTrack,
} from './track.ts';

export interface PresetMeter {
  readonly beatsPerBar: number;
  readonly denominator: number;
}

export interface LibraryOffer {
  readonly sessionId: string;
  readonly track: PlayAlongTrack;
  readonly match: LibraryMatch;
  readonly meter: PresetMeter | undefined;
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

interface MeterRead {
  readonly songId: number | undefined;
  readonly identity: TrackIdentity;
}

const sameRead = (a: MeterRead | undefined, b: MeterRead) =>
  a !== undefined &&
  a.songId === b.songId &&
  sameIdentity(a.identity, b.identity);

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
    sameMatch(a.match, b.match) &&
    a.meter?.beatsPerBar === b.meter?.beatsPerBar &&
    a.meter?.denominator === b.meter?.denominator
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
  let presetMeter:
    (MeterRead & { readonly meter: PresetMeter | undefined }) | undefined;
  let reading: MeterRead | undefined;

  const readMeter = (read: MeterRead) => {
    if (sameRead(reading, read)) return;
    reading = read;
    void presetForTrack(runtime.presets(), read.identity, read.songId)
      .then(meterOfPreset, () => undefined)
      .then((meter) => {
        if (reading !== read) return;
        reading = undefined;
        presetMeter = { ...read, meter };
        refresh();
      });
  };

  const meterFor = (
    seen: MediaSessionSnapshot,
    match: LibraryMatch,
  ): PresetMeter | undefined => {
    const identity = identityOf(seen);
    if (identity === undefined) return undefined;
    const read = {
      songId: match.kind === 'song' ? match.id : undefined,
      identity,
    };
    if (sameRead(presetMeter, read)) return presetMeter?.meter;
    readMeter(read);
    return undefined;
  };

  const forgetStaleDismissal = (seen: MediaSessionSnapshot | undefined) => {
    if (dismissed !== undefined && !(seen && isOfferFor(dismissed, seen)))
      dismissed = undefined;
  };

  const offerNow = (
    seen: MediaSessionSnapshot | undefined,
  ): LibraryOffer | undefined => {
    if (seen === undefined || dismissed !== undefined) return undefined;
    if (getState().lock !== undefined) {
      presetMeter = undefined;
      return undefined;
    }
    const { track, libraryMatch } = runtime.ladder().getState();
    if (libraryMatch === null || !sameSong(track, songOf(seen)))
      return undefined;
    return {
      sessionId: seen.sessionId,
      track: trackOf(seen),
      match: libraryMatch,
      meter: meterFor(seen, libraryMatch),
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

const meterOfPreset = (
  preset: SongPreset | undefined,
): PresetMeter | undefined =>
  preset && {
    beatsPerBar: preset.beatsPerBar,
    denominator: preset.denominator,
  };

function meteredGrid(
  grid: DetectedGrid,
  meter: PresetMeter | undefined,
): DetectedGrid {
  if (meter === undefined || !isGridMeter(meter.beatsPerBar)) return grid;
  return {
    beats: grid.beats,
    downbeatIndices: overrideDownbeats(grid, {
      meterBeatsPerBar: meter.beatsPerBar,
      barOneSeconds: null,
    }),
  };
}

export function acceptAction(
  runtime: PlayAlongRuntime,
  { getState, setState }: StoreAccess<PlayAlongStore>,
  lockOn: LockOn,
) {
  return async (): Promise<LockOutcome> => {
    const { offer } = getState();
    if (offer === undefined) return refused(LOCK_REFUSAL.noOffer);
    const detected = await runtime.readGrid(offer.match).catch(() => NO_GRID);
    const seen = chosenSession(runtime);
    if (getState().offer !== offer || seen === undefined)
      return refused(LOCK_REFUSAL.noOffer);
    if (detected.beats.length === 0) return refused(LOCK_REFUSAL.noGrid);
    const bpm = clamp(offer.match.bpm, BPM_BOUNDS.min, BPM_BOUNDS.max);
    setState({ bpm });
    const { meter } = offer;
    if (meter !== undefined)
      getState().setBeats(meter.beatsPerBar, meter.denominator);
    const grid = meteredGrid(detected, meter);
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
