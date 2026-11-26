import { MS_PER_SECOND } from '@kitbag/core-db';
import type { KB_ACCENT, MediaSessionStep } from '@kitbag/core-native';

import { configuredStore, type StoreAccess } from '../configuredStore.ts';
import { BPM_BOUNDS, clamp } from '../metronome/config.ts';
import { DEFAULT_BPM, initialConfig } from '../metronome/store.ts';
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
  type UnlockReason,
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
import {
  DEFAULT_PHASE_STEP_MS,
  fittedPhase,
  tapPhase,
  type LockPhase,
  type PhaseActions,
  type PhaseState,
} from './phase.ts';
import { phaseActions } from './phaseActions.ts';
import { playAlongSlot, type PlayAlongSlot } from './slot.ts';
import {
  trackPresets,
  type TrackPresetActions,
  type TrackPresetState,
} from './trackPreset.ts';
import { songTempo } from './songTempo.ts';
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

export interface PlayAlongLock extends LockPhase {
  readonly sessionId: string;
  readonly track: PlayAlongTrack;
  readonly downbeatSec: number;
  readonly bpm: number;
  readonly lockedAtBoottimeMs: number;
  readonly grid: DetectedGrid | undefined;
}

export interface PlayAlongState
  extends LibraryOfferState, ClickAloneState, PhaseState, TrackPresetState {
  readonly pattern: PlayAlongPattern;
  readonly bpm: number | undefined;
  readonly lock: PlayAlongLock | undefined;
  readonly songAheadOfClickMs: number | undefined;
  readonly lastAnchorAtBoottimeMs: number | undefined;
  readonly sourceGoneAtBoottimeMs: number | undefined;
  readonly lastRefusal: LockRefusal | undefined;
  readonly unlockReason: UnlockReason | undefined;
}

export interface PlayAlongActions
  extends
    LibraryOfferActions,
    ClickAloneActions,
    PhaseActions,
    TrackPresetActions {
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
      const { lock } = getState();
      if (lock !== undefined)
        setState({
          lock: {
            ...lock,
            ...fittedPhase(lock, pattern(), follow.heardSpeed()),
          },
        });
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
  lockOn: ReturnType<typeof follower>['lockOn'],
) {
  return (atBoottimeMs: number): LockOutcome => {
    const { bpm } = getState();
    if (bpm === undefined) return refused(LOCK_REFUSAL.noBpm);
    const seen = chosenSession(runtime);
    if (seen === undefined) return refused(LOCK_REFUSAL.noSession);
    if (!seen.playing) return refused(LOCK_REFUSAL.paused);
    const songMs = extrapolatedPositionMs(seen, atBoottimeMs);
    if (songMs === null) return refused(LOCK_REFUSAL.unknownPosition);
    lockOn(seen, {
      sessionId: seen.sessionId,
      track: trackOf(seen),
      downbeatSec: songMs / MS_PER_SECOND,
      bpm,
      lockedAtBoottimeMs: atBoottimeMs,
      grid: undefined,
      ...tapPhase(),
    });
    return LOCKED_OUTCOME;
  };
}

const playAlong = configuredStore<PlayAlongRuntime, PlayAlongStore>(
  'Play along',
  nativePlayAlongRuntime,
  (runtime, access) => {
    const offers = libraryOffers(runtime, access);
    const slot = playAlongSlot(
      runtime,
      () => access.getState().pattern,
      (latencyOffsetMs) => {
        access.setState({ latencyOffsetMs });
      },
    );
    const click = clickAlone(runtime, access, slot);
    const follow = follower(runtime, access, slot, () => {
      offers.refresh();
      tempo.resync();
    });
    const showBpm = (next: number) => {
      const { lock, pattern } = access.getState();
      const retimed = lock && {
        ...lock,
        bpm: next,
        grid: undefined,
        gridDownbeats: undefined,
        downbeatShiftAvailable: true,
      };
      access.setState({
        bpm: next,
        lock: retimed && {
          ...retimed,
          ...fittedPhase(retimed, pattern, follow.heardSpeed()),
        },
      });
      click.retempo(next);
      follow.anchor();
    };
    const tempo = songTempo(runtime, access, showBpm);
    const phase = phaseActions(access, follow.anchor, follow.heardSpeed);
    const presets = trackPresets(runtime, access);
    const lockOn: typeof follow.lockOn = (seen, lock) => {
      follow.lockOn(seen, lock);
      const savedPhaseMs = presets.savedPhaseMs();
      if (savedPhaseMs !== undefined) phase.setPhaseOffset(savedPhaseMs);
    };
    const setBpm = (bpm: number) => {
      if (!Number.isFinite(bpm)) return;
      const next = clamp(bpm, BPM_BOUNDS.min, BPM_BOUNDS.max);
      showBpm(next);
      if (access.getState().lock === undefined)
        runtime.ladder().getState().enter(next);
    };
    return {
      pattern: initialPattern(),
      bpm: DEFAULT_BPM,
      offer: undefined,
      lastRefusal: undefined,
      unlockReason: undefined,
      clickPlaying: false,
      hasSavedPreset: false,
      phaseStepMs: DEFAULT_PHASE_STEP_MS,
      latencyOffsetMs: initialConfig().latencyOffset,
      ...NO_LOCK_STATE,
      setBpm,
      startClick: click.start,
      stopClick: click.stop,
      tap: tapAction(runtime, access, lockOn),
      unlock: follow.unlock,
      ...phase,
      saveForTrack: presets.saveForTrack,
      watchLibrary: () => {
        const stopOffers = offers.watchLibrary();
        const stopTempo = tempo.watch();
        const stopClick = click.watch();
        const stopPresets = presets.watch();
        return () => {
          stopPresets();
          stopClick();
          stopTempo();
          stopOffers();
        };
      },
      dismissOffer: offers.dismissOffer,
      acceptOffer: acceptAction(runtime, access, lockOn),
      ...patternSetters(runtime, access, follow, slot),
      ...transport(runtime, access),
    };
  },
);

export const createPlayAlongStore = playAlong.create;
export const configurePlayAlong = playAlong.configure;
export const getPlayAlongStore = playAlong.get;
