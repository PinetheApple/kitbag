import { MS_PER_SECOND } from '@kitbag/core-db';
import type { KB_ACCENT, MediaSessionStep } from '@kitbag/core-native';

import { configuredStore, type StoreAccess } from '../configuredStore.ts';
import { BPM_BOUNDS, clamp } from '../metronome/config.ts';
import type { DetectedGrid } from '../stemPlayer/meterOverride.ts';
import {
  clickAlone,
  type ClickAloneActions,
  type ClickAloneState,
} from './clickAlone.ts';
import { follower, NO_LOCK_STATE } from './follower.ts';
import {
  acceptAction,
  chosenSession,
  libraryOffers,
  type LibraryOfferActions,
  type LibraryOfferState,
} from './libraryOffer.ts';
import {
  LOCK_REFUSAL,
  LOCKED_OUTCOME,
  refused,
  type LockOutcome,
  type LockRefusal,
} from './lockOutcome.ts';
import {
  initialPattern,
  withAccents,
  withMeter,
  withSounds,
  withSubdivision,
  withVolume,
  type PatternEdit,
  type PlayAlongPattern,
} from './pattern.ts';
import { extrapolatedPositionMs } from './position.ts';
import { nativePlayAlongRuntime, type PlayAlongRuntime } from './runtime.ts';
import { playAlongSlot, type PlayAlongSlot } from './slot.ts';
import { songTempo, startingBpm } from './songTempo.ts';
import { findSession, trackOf, type PlayAlongTrack } from './track.ts';

export type { PlayAlongTrack } from './track.ts';
export {
  LOCK_REFUSAL,
  type LockOutcome,
  type LockRefusal,
} from './lockOutcome.ts';

export {
  ANCHOR_RETRY_MS,
  REANCHOR_INTERVAL_MS,
  SEEK_JUMP_MS,
  SOURCE_GONE_HOLD_MS,
} from './follower.ts';

export interface PlayAlongLock {
  readonly sessionId: string;
  readonly track: PlayAlongTrack;
  readonly downbeatSec: number;
  readonly bpm: number;
  readonly lockedAtBoottimeMs: number;
  readonly grid: DetectedGrid | undefined;
}

export interface PlayAlongState extends LibraryOfferState, ClickAloneState {
  readonly pattern: PlayAlongPattern;
  readonly bpm: number | undefined;
  readonly lock: PlayAlongLock | undefined;
  readonly songAheadOfClickMs: number | undefined;
  readonly lastAnchorAtBoottimeMs: number | undefined;
  readonly sourceGoneAtBoottimeMs: number | undefined;
  readonly lastRefusal: LockRefusal | undefined;
}

export interface PlayAlongActions
  extends LibraryOfferActions, ClickAloneActions {
  readonly setBpm: (bpm: number) => void;
  readonly tap: (atBoottimeMs: number) => LockOutcome;
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
  slot: PlayAlongSlot,
) {
  const apply = (edit: PatternEdit | undefined) => {
    if (edit === undefined) return;
    setState({ pattern: edit.pattern });
    if (slot.held()) edit.send(runtime.commands);
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
  return (atBoottimeMs: number): LockOutcome => {
    const { bpm } = getState();
    if (bpm === undefined) return refused(LOCK_REFUSAL.noBpm);
    const seen = chosenSession(runtime);
    if (seen === undefined) return refused(LOCK_REFUSAL.noSession);
    if (!seen.playing) return refused(LOCK_REFUSAL.paused);
    const songMs = extrapolatedPositionMs(seen, atBoottimeMs);
    if (songMs === null) return refused(LOCK_REFUSAL.unknownPosition);
    follow.lockOn(seen, {
      sessionId: seen.sessionId,
      track: trackOf(seen),
      downbeatSec: songMs / MS_PER_SECOND,
      bpm,
      lockedAtBoottimeMs: atBoottimeMs,
      grid: undefined,
    });
    return LOCKED_OUTCOME;
  };
}

const playAlong = configuredStore<PlayAlongRuntime, PlayAlongStore>(
  'Play along',
  nativePlayAlongRuntime,
  (runtime, access) => {
    const offers = libraryOffers(runtime, access);
    const slot = playAlongSlot(runtime, () => access.getState().pattern);
    const click = clickAlone(runtime, access, slot);
    const follow = follower(runtime, access, slot, () => {
      offers.refresh();
      tempo.resync();
    });
    const showBpm = (next: number) => {
      const { lock } = access.getState();
      access.setState({
        bpm: next,
        lock: lock && { ...lock, bpm: next, grid: undefined },
      });
      click.retempo(next);
      follow.anchor();
    };
    const tempo = songTempo(runtime, access, showBpm);
    const setBpm = (bpm: number) => {
      if (!Number.isFinite(bpm)) return;
      const next = clamp(bpm, BPM_BOUNDS.min, BPM_BOUNDS.max);
      showBpm(next);
      if (access.getState().lock === undefined)
        runtime.ladder().getState().enter(next);
    };
    return {
      pattern: initialPattern(),
      bpm: startingBpm(runtime),
      offer: undefined,
      lastRefusal: undefined,
      clickPlaying: false,
      ...NO_LOCK_STATE,
      setBpm,
      startClick: click.start,
      stopClick: click.stop,
      tap: tapAction(runtime, access, follow),
      unlock: follow.unlock,
      watchLibrary: () => {
        const stopOffers = offers.watchLibrary();
        const stopTempo = tempo.watch();
        const stopClick = click.watch();
        return () => {
          stopClick();
          stopTempo();
          stopOffers();
        };
      },
      dismissOffer: offers.dismissOffer,
      acceptOffer: acceptAction(runtime, access, follow.lockOn),
      ...patternSetters(runtime, access, follow, slot),
      ...transport(runtime, access),
    };
  },
);

export const createPlayAlongStore = playAlong.create;
export const configurePlayAlong = playAlong.configure;
export const getPlayAlongStore = playAlong.get;
