import {
  boottimeNowMs,
  engineFrameAtBoottimeMs,
  getKitbagCommands,
  getKitbagHostObject,
  mediaSessionCommand,
  type KitbagCommandsSpec,
  type PlayAlongCardRequest,
} from '@kitbag/core-native';
import type { StoreApi } from 'zustand/vanilla';

import {
  getMediaSessionsStore,
  type MediaSessionsStore,
} from '../mediaSessions/store.ts';
import { metronomeStore, type MetronomeActions } from '../metronome/store.ts';
import { getNotificationPermissionStore } from '../notifications/store.ts';
import type { DetectedGrid } from '../stemPlayer/meterOverride.ts';
import { onSongStarting } from '../stemPlayer/songStarting.ts';
import type { LibraryMatch } from '../tempoLadder/libraryMatch.ts';
import { getTempoLadder } from '../tempoLadder/runtime.ts';
import {
  tempoLadderStore,
  type TempoLadderStore,
} from '../tempoLadder/store.ts';
import { getLibrary } from '../library/runtime.ts';
import { readLibraryGrid } from './libraryGrid.ts';
import type { TrackPresets } from './trackPreset.ts';

export type PlayAlongCommands = Pick<
  KitbagCommandsSpec,
  | 'engineHold'
  | 'engineRelease'
  | 'metronomeSelectSlot'
  | 'metronomeAnchorExternal'
  | 'metronomeAnchorGrid'
  | 'metronomeSetGridDownbeats'
  | 'setGrid'
  | 'clearGrid'
  | 'metronomePause'
  | 'metronomeStart'
  | 'metronomeStop'
  | 'setTempo'
  | 'setBeats'
  | 'setAccent'
  | 'setSubdivision'
  | 'setSounds'
  | 'setVolume'
  | 'setLatencyOffset'
  | 'setPoly'
  | 'setBarMute'
  | 'setRamp'
  | 'setCountIn'
  | 'playAlongCardShow'
  | 'playAlongCardHide'
>;

export type FollowedSessions = Pick<
  StoreApi<Pick<MediaSessionsStore, 'sessions' | 'chosenId' | 'pick'>>,
  'getState' | 'subscribe'
>;

export type FollowedLadder = Pick<
  StoreApi<
    Pick<
      TempoLadderStore,
      | 'track'
      | 'libraryMatch'
      | 'bpm'
      | 'source'
      | 'tapsLanded'
      | 'lookUp'
      | 'tap'
      | 'enter'
    >
  >,
  'getState' | 'subscribe'
>;

type Unsubscribe = () => void;

type OnStarting = (listener: () => void) => Unsubscribe;

const unsubscriber =
  (subscription: { remove: () => void }): Unsubscribe =>
  () => {
    subscription.remove();
  };

export interface PlayAlongRuntime {
  readonly commands: PlayAlongCommands;
  readonly boottimeNowMs: typeof boottimeNowMs;
  readonly nowFrame: () => number;
  readonly engineFrameAtBoottimeMs: typeof engineFrameAtBoottimeMs;
  readonly sessions: () => FollowedSessions;
  readonly ladder: () => FollowedLadder;
  readonly readGrid: (match: LibraryMatch) => Promise<DetectedGrid>;
  readonly sessionCommand: typeof mediaSessionCommand;
  readonly latencyOffsetMs: () => number;
  readonly onClickStarting: OnStarting;
  readonly yieldStandalone: () => () => void;
  readonly onCardRequest: (
    listener: (request: PlayAlongCardRequest) => void,
  ) => Unsubscribe;
  readonly playbackStarted: () => void;
  readonly presets: () => TrackPresets;
}

type StartingMetronome = Pick<
  StoreApi<Pick<MetronomeActions, 'onStarting'>>,
  'getState'
>;

export function clickStartsOf(
  metronome: StartingMetronome,
  songCardStarts: OnStarting,
): OnStarting {
  return (listener) => {
    const stopMetronome = metronome.getState().onStarting(listener);
    const stopSongs = onSongStarting(listener);
    const stopCardSongs = songCardStarts(listener);
    return () => {
      stopMetronome();
      stopSongs();
      stopCardSongs();
    };
  };
}

const nativeSongCardStarts: OnStarting = (listener) =>
  unsubscriber(getKitbagCommands().onSongCardStarted(listener));

export const nativePlayAlongRuntime: PlayAlongRuntime = {
  get commands() {
    return getKitbagCommands();
  },
  boottimeNowMs: () => boottimeNowMs(),
  nowFrame: () => getKitbagHostObject().frames_rendered,
  engineFrameAtBoottimeMs: (ms) => engineFrameAtBoottimeMs(ms),
  sessions: () => getMediaSessionsStore(),
  ladder: () => tempoLadderStore,
  readGrid: (match) => readLibraryGrid(getTempoLadder().library, match),
  sessionCommand: (sessionId, command) => {
    mediaSessionCommand(sessionId, command);
  },
  latencyOffsetMs: () => metronomeStore.getState().latencyOffset,
  onClickStarting: clickStartsOf(metronomeStore, nativeSongCardStarts),
  yieldStandalone: () => metronomeStore.getState().yieldEngine(),
  onCardRequest: (listener) =>
    unsubscriber(getKitbagCommands().onPlayAlongCard(listener)),
  playbackStarted: () => {
    void getNotificationPermissionStore().getState().playbackStarted();
  },
  presets: () => getLibrary().presets,
};
