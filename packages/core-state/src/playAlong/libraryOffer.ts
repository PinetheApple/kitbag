import {
  NO_METER_OVERRIDE,
  isGridMeter,
  type SongPreset,
} from '@kitbag/core-db';
import type { MediaSessionSnapshot } from '@kitbag/core-native';

import type { StoreAccess } from '../configuredStore.ts';
import { BPM_BOUNDS, clamp } from '../metronome/config.ts';
import { initialConfig } from '../metronome/store.ts';
import { NO_GRID } from '../songPlayer/songGrid.ts';
import {
  detectedMeter,
  overrideDownbeats,
  type DetectedGrid,
} from '../stemPlayer/meterOverride.ts';
import type { LibraryMatch } from '../tempoLadder/libraryMatch.ts';
import { BPM_SOURCE } from '../tempoLadder/sources.ts';
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
  gridMeterOf,
  presetMeters,
  sameMeter,
  type PresetMeter,
  type PresetMeters,
} from './presetMeters.ts';
import type { PlayAlongRuntime } from './runtime.ts';
import type { PlayAlongLock, PlayAlongStore } from './store.ts';
import {
  findSession,
  sameTrack,
  songOf,
  trackOf,
  type PlayAlongTrack,
} from './track.ts';

export type { PresetMeter } from './presetMeters.ts';

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

const isOfferFor = (offer: LibraryOffer, seen: MediaSessionSnapshot) =>
  offer.sessionId === seen.sessionId && sameTrack(offer.track, seen);

const sameMatch = (a: LibraryMatch, b: LibraryMatch) =>
  a.kind === b.kind && a.id === b.id && a.bpm === b.bpm;

const sameOfferTrack = (a: LibraryOffer, b: LibraryOffer) =>
  a.sessionId === b.sessionId &&
  a.track.title === b.track.title &&
  a.track.artist === b.track.artist &&
  a.track.durationMs === b.track.durationMs;

function sameOffer(a: LibraryOffer | undefined, b: LibraryOffer | undefined) {
  if (a === undefined || b === undefined) return a === b;
  return (
    sameOfferTrack(a, b) &&
    sameMatch(a.match, b.match) &&
    sameMeter(a.meter, b.meter)
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
  const meters = presetMeters(runtime, () => {
    refresh();
  });

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
    const lookup = meters.meterFor(seen, libraryMatch);
    if (!lookup.settled) return undefined;
    return {
      sessionId: seen.sessionId,
      track: trackOf(seen),
      match: libraryMatch,
      meter: lookup.meter,
    };
  };

  const refresh = () => {
    if (getState().lock !== undefined) meters.forget();
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

  return {
    refresh,
    watchLibrary,
    dismissOffer,
    presetFor: meters.presetFor,
  };
}

interface AcceptSteps {
  readonly lockOn: (seen: MediaSessionSnapshot, lock: PlayAlongLock) => void;
  readonly applyPreset: (preset: SongPreset) => void;
  readonly presetFor: PresetMeters['presetFor'];
}

function meteredGrid(
  grid: DetectedGrid,
  meter: PresetMeter | undefined,
): DetectedGrid {
  if (meter === undefined || !isGridMeter(meter.beatsPerBar)) return grid;
  return {
    beats: grid.beats,
    downbeatIndices: overrideDownbeats(grid, {
      ...NO_METER_OVERRIDE,
      meterBeatsPerBar: meter.beatsPerBar,
    }),
  };
}

export function acceptAction(
  runtime: PlayAlongRuntime,
  { getState, setState }: StoreAccess<PlayAlongStore>,
  { lockOn, applyPreset, presetFor }: AcceptSteps,
) {
  return async (): Promise<LockOutcome> => {
    const { offer } = getState();
    const asked = chosenSession(runtime);
    if (offer === undefined || asked === undefined)
      return refused(LOCK_REFUSAL.noOffer);
    const [detected, preset] = await Promise.all([
      runtime.readGrid(offer.match).catch(() => NO_GRID),
      presetFor(asked, offer.match),
    ]);
    const seen = chosenSession(runtime);
    const current = getState().offer;
    if (
      seen === undefined ||
      current === undefined ||
      !sameOfferTrack(offer, current) ||
      !isOfferFor(offer, seen)
    )
      return refused(LOCK_REFUSAL.noOffer);
    if (detected.beats.length === 0) return refused(LOCK_REFUSAL.noGrid);
    const bpm = clamp(offer.match.bpm, BPM_BOUNDS.min, BPM_BOUNDS.max);
    setState({ bpm });
    if (preset !== undefined) applyPreset(preset);
    const meter = gridMeterOf(preset);
    const grid = meteredGrid(detected, meter);
    getState().setBeats(
      detectedMeter(grid).meter,
      meter?.denominator ?? initialConfig().denominator,
    );
    lockOn(seen, {
      sessionId: seen.sessionId,
      track: trackOf(seen),
      downbeatSec: firstDownbeatSec(grid),
      bpm,
      lockedAtBoottimeMs: runtime.boottimeNowMs(),
      grid,
      ...gridPhase(grid),
    });
    runtime.ladder().getState().enter(bpm, BPM_SOURCE.library);
    return LOCKED_OUTCOME;
  };
}
