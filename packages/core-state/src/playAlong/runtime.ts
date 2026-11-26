import {
  boottimeNowMs,
  engineFrameAtBoottimeMs,
  getKitbagCommands,
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
import { onSongStarting } from '../stemPlayer/songStarting.ts';

export type PlayAlongCommands = Pick<
  KitbagCommandsSpec,
  | 'engineHold'
  | 'engineRelease'
  | 'metronomeSelectSlot'
  | 'metronomeAnchorExternal'
  | 'metronomePause'
  | 'metronomeStop'
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

type Unsubscribe = () => void;

type Starts = (listener: () => void) => Unsubscribe;

export interface PlayAlongRuntime {
  readonly commands: PlayAlongCommands;
  readonly boottimeNowMs: typeof boottimeNowMs;
  readonly engineFrameAtBoottimeMs: typeof engineFrameAtBoottimeMs;
  readonly sessions: () => FollowedSessions;
  readonly sessionCommand: typeof mediaSessionCommand;
  readonly latencyOffsetMs: () => number;
  readonly onClickStarting: Starts;
  readonly yieldStandalone: () => () => void;
  readonly onCardRequest: (
    listener: (request: PlayAlongCardRequest) => void,
  ) => Unsubscribe;
  readonly playbackStarted: () => void;
}

type StartingMetronome = Pick<
  StoreApi<Pick<MetronomeActions, 'onStarting'>>,
  'getState'
>;

export function clickStartsOf(
  metronome: StartingMetronome,
  songCardStarts: Starts,
): Starts {
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

const nativeSongCardStarts: Starts = (listener) => {
  const subscription = getKitbagCommands().onSongCardStarted(listener);
  return () => {
    subscription.remove();
  };
};

export const nativePlayAlongRuntime: PlayAlongRuntime = {
  get commands() {
    return getKitbagCommands();
  },
  boottimeNowMs: () => boottimeNowMs(),
  engineFrameAtBoottimeMs: (ms) => engineFrameAtBoottimeMs(ms),
  sessions: () => getMediaSessionsStore(),
  sessionCommand: (sessionId, command) => {
    mediaSessionCommand(sessionId, command);
  },
  latencyOffsetMs: () => metronomeStore.getState().latencyOffset,
  onClickStarting: clickStartsOf(metronomeStore, nativeSongCardStarts),
  yieldStandalone: () => metronomeStore.getState().yieldEngine(),
  onCardRequest: (listener) => {
    const subscription = getKitbagCommands().onPlayAlongCard(listener);
    return () => {
      subscription.remove();
    };
  },
  playbackStarted: () => {
    void getNotificationPermissionStore().getState().playbackStarted();
  },
};
