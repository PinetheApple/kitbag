import type { SongLibraryRepository } from '@kitbag/core-db';
import type { KitbagCommandsSpec } from '@kitbag/core-native';

export type StemPlayerCommands = Pick<
  KitbagCommandsSpec,
  | 'start'
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
  | 'setGrid'
  | 'clearGrid'
  | 'metronomeFollowMixer'
  | 'metronomeStart'
  | 'metronomeStop'
  | 'songTransportShow'
  | 'songTransportHide'
>;

// Synchronous HostObject reads, taken at human speed on the JS thread.
export interface StemPlayerEngine {
  readonly sampleRate: () => number;
  readonly position: () => number;
  readonly playing: () => boolean;
  readonly nowFrame: () => number;
}

export type StemPlayerRecords = Pick<
  SongLibraryRepository,
  'readStemSet' | 'saveStemMix' | 'renameStem'
>;

// The metronome tool's transport, running or paused behind its notification,
// which the stem player's click displaces.
export interface SharedMetronome {
  readonly active: () => boolean;
  readonly release: () => void;
}

export interface StemPlayerRuntime {
  readonly commands: StemPlayerCommands;
  readonly engine: StemPlayerEngine;
  readonly sharedMetronome: SharedMetronome;
  readonly records: StemPlayerRecords;
  readonly readWaveform: (
    relativePath: string,
    buckets: number,
  ) => Promise<readonly number[]>;
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
