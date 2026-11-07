import type { SongLibraryRepository } from '@kitbag/core-db';
import type { KitbagCommandsSpec } from '@kitbag/core-native';

export type StemPlayerCommands = Pick<
  KitbagCommandsSpec,
  | 'start'
  | 'engineHold'
  | 'engineRelease'
  | 'loadTrack'
  | 'mixerUnloadTrack'
  | 'mixerSetGain'
  | 'mixerSetMute'
  | 'mixerSetSolo'
  | 'mixerSetMasterGain'
  | 'mixerMasterGain'
  | 'mixerPlay'
  | 'mixerPause'
  | 'mixerStop'
  | 'mixerSeek'
  | 'mixerSetLoop'
  | 'mixerClearLoop'
  | 'mixerSetRate'
  | 'mixerRate'
  | 'mixerSetTrackPitch'
  | 'mixerTrackPitch'
  | 'mixerTrackFrames'
  | 'setGrid'
  | 'clearGrid'
  | 'metronomeFollowMixer'
  | 'metronomeStart'
  | 'metronomeStop'
  | 'songTransportShow'
  | 'songTransportHide'
> & {
  readonly onSongStopped: (handler: () => void) => {
    readonly remove: () => void;
  };
};

// Synchronous HostObject reads, taken at human speed on the JS thread.
export interface StemPlayerEngine {
  readonly sampleRate: () => number;
  readonly position: () => number;
  readonly playing: () => boolean;
  readonly nowFrame: () => number;
}

export type StemPlayerRecords = Pick<
  SongLibraryRepository,
  'readStemSet' | 'saveStemMix' | 'renameStem' | 'saveLyricsRetimed'
>;

// The metronome tool's transport, running or paused behind its notification;
// opening a mixer session or starting its click displaces it.
export interface SharedMetronome {
  readonly active: () => boolean;
  readonly release: () => void;
}

export interface MixerRuntime {
  readonly commands: StemPlayerCommands;
  readonly engine: StemPlayerEngine;
  readonly sharedMetronome: SharedMetronome;
  readonly readWaveform: (
    relativePath: string,
    buckets: number,
  ) => Promise<readonly number[]>;
}

export interface StemPlayerRuntime extends MixerRuntime {
  readonly records: StemPlayerRecords;
}

let configured: StemPlayerRuntime | undefined;

export function configureStemPlayer(runtime: StemPlayerRuntime): void {
  if (configured !== undefined && configured !== runtime) {
    throw new Error('Stem player is already configured');
  }
  configured = runtime;
}

export function getStemPlayer(): StemPlayerRuntime {
  if (configured === undefined) {
    throw new Error('Stem player is not configured');
  }
  return configured;
}
