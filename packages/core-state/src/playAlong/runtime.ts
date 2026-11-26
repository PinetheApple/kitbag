import {
  boottimeNowMs,
  engineFrameAtBoottimeMs,
  getKitbagCommands,
  mediaSessionCommand,
  type KitbagCommandsSpec,
} from '@kitbag/core-native';
import type { StoreApi } from 'zustand/vanilla';

import {
  getMediaSessionsStore,
  type MediaSessionsStore,
} from '../mediaSessions/store.ts';
import { metronomeStore, type MetronomeActions } from '../metronome/store.ts';
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
>;

export type FollowedSessions = Pick<
  StoreApi<Pick<MediaSessionsStore, 'sessions' | 'chosenId' | 'pick'>>,
  'getState' | 'subscribe'
>;

type Unsubscribe = () => void;

export interface PlayAlongRuntime {
  readonly commands: PlayAlongCommands;
  readonly boottimeNowMs: typeof boottimeNowMs;
  readonly engineFrameAtBoottimeMs: typeof engineFrameAtBoottimeMs;
  readonly sessions: () => FollowedSessions;
  readonly sessionCommand: typeof mediaSessionCommand;
  readonly latencyOffsetMs: () => number;
  readonly onClickStarting: (listener: () => void) => Unsubscribe;
  readonly yieldStandalone: () => () => void;
}

type StartingMetronome = Pick<
  StoreApi<Pick<MetronomeActions, 'onStarting'>>,
  'getState'
>;

export function clickStartsOf(
  metronome: StartingMetronome,
): PlayAlongRuntime['onClickStarting'] {
  return (listener) => {
    const stopMetronome = metronome.getState().onStarting(listener);
    const stopSongs = onSongStarting(listener);
    return () => {
      stopMetronome();
      stopSongs();
    };
  };
}

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
  onClickStarting: clickStartsOf(metronomeStore),
  yieldStandalone: () => metronomeStore.getState().yieldEngine(),
};
