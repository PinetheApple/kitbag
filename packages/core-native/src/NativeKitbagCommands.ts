// Write path only; 60fps reads go through the JSI HostObject (SPEC §13.3).
// Frame arguments are uint64 engine frames as doubles, exact below 2^53.

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type {
  Double,
  EventEmitter,
  Int32,
} from 'react-native/Libraries/Types/CodegenTypes';

/** A notification, lock-screen or headset action the engine already applied. */
export type TransportEvent = Readonly<{
  playback: string;
  bpm: Double;
  rampRunning: boolean;
  practicePlayedMs: Double;
  practiceStretchStartedAt: Double;
  songStep: 'previous' | 'next' | null;
}>;

export type TransportSetlist = Readonly<{
  subtitle: string;
  index: Int32 | null;
  songCount: Int32;
}>;

export type TransportShowState = Readonly<{
  playing: boolean;
  bpm: Double;
  rampRunning: boolean;
  beatsPerBar: Int32;
  beatUnit: Int32;
  minBpm: Double;
  maxBpm: Double;
  practicePlayedMs: Double;
  practiceStretchStartedAt: Double;
  setlist: TransportSetlist | null;
}>;

export type SongTransportShowState = Readonly<{
  playing: boolean;
  title: string;
  artist: string | null;
  durationFrames: Double;
  restartFromFrame: Double;
  skipSeconds: Double;
}>;

export type KitbagCommandsConstants = Readonly<{
  versionName: string;
  versionCode: Double;
}>;

export interface Spec extends TurboModule {
  getConstants(): KitbagCommandsConstants;
  start(): Promise<number>;
  stop(): void;
  engineHold(): Promise<number>;
  engineRelease(): void;

  metronomeStart(anchorFrame: Double): void;
  metronomeStop(): void;
  metronomePause(): void;

  setTempo(bpm: Double): void;
  setGrid(
    beatTimesSec: readonly Double[],
    anchorFrame: Double,
  ): Promise<number>;
  clearGrid(): void;
  metronomeFollowMixer(enabled: boolean): void;

  setBeats(beatsPerBar: Int32, denominator: Int32): void;
  setSubdivision(subdivision: Int32): void;
  setAccent(beatIndex: Int32, accent: Int32): void;
  setPoly(enabled: boolean, beats: Int32): void;
  setPolyAccent(beatIndex: Int32, accent: Int32): void;
  setPolyAgainst(mainBeats: Int32): void;
  setSounds(normalSound: Int32, accentSound: Int32): void;
  previewSound(sound: Int32, accented: boolean): void;
  setCountIn(bars: Int32, distinct: boolean, sound: Int32): void;
  setVolume(volume: Double): void;
  setLatencyOffset(latencyMs: Double): void;

  setRamp(
    enabled: boolean,
    startBpm: Double,
    targetBpm: Double,
    stepBpm: Double,
    interval: Double,
    unit: Int32,
    loop: boolean,
  ): void;
  setBarMute(enabled: boolean, playBars: Int32, muteBars: Int32): void;

  loadTrack(track: Int32, relativePath: string): Promise<number>;
  mixerUnloadTrack(track: Int32): void;
  mixerSetGain(track: Int32, gain: Double): void;
  mixerSetMute(track: Int32, muted: boolean): void;
  mixerSetSolo(track: Int32, soloed: boolean): void;
  mixerSetMasterGain(gain: Double): void;
  mixerMasterGain(): Promise<number>;
  mixerPlay(): void;
  mixerPause(): void;
  mixerStop(): void;
  mixerSeek(frame: Double): void;
  mixerSetLoop(startFrame: Double, endFrame: Double): Promise<number>;
  mixerClearLoop(): Promise<number>;

  // --- Tuner (kitbag_tuner_api.h) ------------------------------------------
  //
  // Every tuner command is async: the engine wants all kb_tuner_* setters from
  // one app thread, and async methods share the single native-modules thread
  // whereas a sync one would run on the JS thread.

  tunerStart(): Promise<number>;
  tunerStop(): void;
  tunerSetTuning(
    instrument: Int32,
    stringMidis: readonly Int32[],
  ): Promise<number>;
  tunerSetTargetString(stringIndex: Int32): Promise<number>;
  tunerSetChromatic(): Promise<number>;
  tunerSetA4(a4Hz: Double): Promise<number>;
  tunerResetNotePresence(pauseMs: Double): Promise<number>;

  transportShow(state: TransportShowState): void;
  transportHide(): void;
  songTransportShow(state: SongTransportShowState): void;
  songTransportHide(): void;
  setKeepScreenOn(on: boolean): void;
  setAppNightMode(mode: string): void;
  setSystemBarAppearance(light: boolean): void;
  readonly onTransport: EventEmitter<TransportEvent>;
}

// Lazy: resolving throws until the native module is registered, and the barrel
// re-exports this file, so an eager resolve would break importing a constant.
export function getKitbagCommands(): Spec {
  return TurboModuleRegistry.getEnforcing<Spec>('KitbagCommands');
}
