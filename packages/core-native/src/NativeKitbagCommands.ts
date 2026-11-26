// Write path only; 60fps reads go through the JSI HostObject (SPEC §13.3).
// Frame arguments are uint64 engine frames as doubles, exact up to KB_MAX_EXACT_FRAME.

import type { CodegenTypes, TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/** A notification, lock-screen or headset action the engine already applied. */
export type TransportEvent = Readonly<{
  playback: string;
  bpm: CodegenTypes.Double;
  rampRunning: boolean;
  practicePlayedMs: CodegenTypes.Double;
  practiceStretchStartedAt: CodegenTypes.Double;
  cardNumber: CodegenTypes.Int32;
  action: string;
  tempoStep: CodegenTypes.Int32;
  engineBpm: CodegenTypes.Double;
}>;

export type TransportSetlist = Readonly<{
  subtitle: string;
}>;

export type TransportShowState = Readonly<{
  playback: string;
  bpm: CodegenTypes.Double;
  rampRunning: boolean;
  beatsPerBar: CodegenTypes.Int32;
  beatUnit: CodegenTypes.Int32;
  minBpm: CodegenTypes.Double;
  maxBpm: CodegenTypes.Double;
  practicePlayedMs: CodegenTypes.Double;
  practiceStretchStartedAt: CodegenTypes.Double;
  setlist: TransportSetlist | null;
  cardNumber: CodegenTypes.Int32;
}>;

export type SongTransportShowState = Readonly<{
  playing: boolean;
  countingIn: boolean;
  title: string;
  artist: string | null;
  durationFrames: CodegenTypes.Double;
  restartFromFrame: CodegenTypes.Double;
  skipSeconds: CodegenTypes.Double;
  session: CodegenTypes.Int32;
  followsPlayOrder: boolean;
}>;

export type SongTransportOrder = Readonly<{
  previous: boolean;
  next: boolean;
}>;

export type SongTransportRequest = Readonly<{
  action: 'play' | 'pause' | 'stop' | 'seek' | 'next' | 'previous';
  frame: CodegenTypes.Double | null;
  shownSession: CodegenTypes.Int32;
}>;

export type OutputRoute = Readonly<{
  id: string;
  name: string;
  kind: 'speaker' | 'wired' | 'bluetooth' | 'usb' | 'other';
  certain: boolean;
}>;

/** `path` is where the render writes, whatever `result` says. */
export type MixdownStartReply = Readonly<{
  result: CodegenTypes.Int32;
  path: string;
}>;

/** kb_fit_constant_tempo's outputs; each reads 0 unless `result` is KB_OK. */
export type ConstantTempoFit = Readonly<{
  result: CodegenTypes.Int32;
  bpm: CodegenTypes.Double;
  anchorSec: CodegenTypes.Double;
  beatsPerBar: CodegenTypes.Int32;
}>;

export type KitbagCommandsConstants = Readonly<{
  versionName: string;
  versionCode: CodegenTypes.Double;
}>;

export interface Spec extends TurboModule {
  getConstants(): KitbagCommandsConstants;
  start(): Promise<number>;
  stop(): void;
  engineHold(): Promise<number>;
  engineRelease(): void;

  metronomeStart(anchorFrame: CodegenTypes.Double): void;
  metronomeStop(): void;
  metronomePause(): void;
  /** A KB_METRONOME_SLOT; every later metronome command and read addresses it. */
  metronomeSelectSlot(slot: CodegenTypes.Int32): void;
  /** kb_metronome_anchor_external, then the device; a bad atFrame or a non-finite value is dropped. */
  metronomeAnchorExternal(
    songPosSec: CodegenTypes.Double,
    atFrame: CodegenTypes.Double,
    bpm: CodegenTypes.Double,
  ): void;

  rigClickStart(
    bpm: CodegenTypes.Double,
    subdivision: CodegenTypes.Int32,
    startFrame: CodegenTypes.Double,
  ): Promise<number>;
  rigClickStop(): void;
  rigClickIsActive(): Promise<boolean>;

  setTempo(bpm: CodegenTypes.Double): void;
  setGrid(
    beatTimesSec: readonly CodegenTypes.Double[],
    downbeatIndices: readonly CodegenTypes.Int32[],
    anchorFrame: CodegenTypes.Double,
  ): Promise<number>;
  clearGrid(): void;
  /** Beats go to the fit as 32-bit floats. Rejects E_FIT_FAILED if the bridge throws. */
  fitConstantTempo(
    beatTimesSec: readonly CodegenTypes.Double[],
    downbeatIndices: readonly CodegenTypes.Int32[],
  ): Promise<ConstantTempoFit>;
  setGridGrouping(sizes: readonly CodegenTypes.Int32[]): Promise<number>;
  setGridRate(rate: CodegenTypes.Int32): Promise<number>;
  metronomeFollowMixer(enabled: boolean): void;

  setBeats(
    beatsPerBar: CodegenTypes.Int32,
    denominator: CodegenTypes.Int32,
  ): void;
  setSubdivision(subdivision: CodegenTypes.Int32): void;
  setSubdivisionAccents(
    subdivision: CodegenTypes.Int32,
    slotMask: CodegenTypes.Int32,
  ): void;
  setAccent(beatIndex: CodegenTypes.Int32, accent: CodegenTypes.Int32): void;
  setPoly(enabled: boolean, beats: CodegenTypes.Int32): void;
  setPolyAccent(
    beatIndex: CodegenTypes.Int32,
    accent: CodegenTypes.Int32,
  ): void;
  setPolyAgainst(mainBeats: CodegenTypes.Int32): void;
  setSounds(
    normalSound: CodegenTypes.Int32,
    accentSound: CodegenTypes.Int32,
  ): void;
  previewSound(sound: CodegenTypes.Int32, accented: boolean): void;
  setCountIn(
    bars: CodegenTypes.Int32,
    distinct: boolean,
    sound: CodegenTypes.Int32,
  ): void;
  setVolume(volume: CodegenTypes.Double): void;
  setLatencyOffset(latencyMs: CodegenTypes.Double): void;

  setRamp(
    enabled: boolean,
    startBpm: CodegenTypes.Double,
    targetBpm: CodegenTypes.Double,
    stepBpm: CodegenTypes.Double,
    interval: CodegenTypes.Double,
    unit: CodegenTypes.Int32,
    loop: boolean,
  ): void;
  setBarMute(
    enabled: boolean,
    playBars: CodegenTypes.Int32,
    muteBars: CodegenTypes.Int32,
  ): void;

  loadTrack(track: CodegenTypes.Int32, relativePath: string): Promise<number>;
  mixerUnloadTrack(track: CodegenTypes.Int32): void;
  mixerSetGain(track: CodegenTypes.Int32, gain: CodegenTypes.Double): void;
  mixerSetMute(track: CodegenTypes.Int32, muted: boolean): void;
  mixerSetSolo(track: CodegenTypes.Int32, soloed: boolean): void;
  mixerSetMasterGain(gain: CodegenTypes.Double): void;
  mixerMasterGain(): Promise<number>;
  mixerPlay(): void;
  mixerPause(): void;
  mixerStop(): void;
  mixerSeek(frame: CodegenTypes.Double): void;
  /** Seek first: it starts from the current head. */
  songCountIn(
    endFrame: CodegenTypes.Double,
    beatFrames: CodegenTypes.Double,
    beatsPerBar: CodegenTypes.Int32,
    startClick: boolean,
  ): Promise<number>;
  songPause(): void;
  songStop(): void;
  mixerSetLoop(
    startFrame: CodegenTypes.Double,
    endFrame: CodegenTypes.Double,
  ): Promise<number>;
  mixerClearLoop(): Promise<number>;
  mixerSetRate(rate: CodegenTypes.Double): Promise<number>;
  mixerRate(): Promise<number>;
  mixerSetTrackPitch(
    track: CodegenTypes.Int32,
    semitones: CodegenTypes.Int32,
  ): Promise<number>;
  mixerTrackPitch(track: CodegenTypes.Int32): Promise<number>;
  mixerTrackFrames(track: CodegenTypes.Int32): Promise<number>;
  /** Rejects E_BAD_FILE_NAME for a name unsafe as a path; old exports are cleared. */
  mixdownStart(fileName: string): Promise<MixdownStartReply>;
  mixdownCancel(): void;

  /** Rejects E_BAD_FILE_NAME for a name unsafe as a click sound file. */
  loadCustomSound(slot: CodegenTypes.Int32, fileName: string): Promise<number>;
  clearCustomSound(slot: CodegenTypes.Int32): void;
  customSoundLoaded(slot: CodegenTypes.Int32): Promise<boolean>;

  // --- Tuner (kitbag_tuner_api.h) ------------------------------------------
  //
  // Every tuner command is async: the engine wants all kb_tuner_* setters from
  // one app thread, and async methods share the single native-modules thread
  // whereas a sync one would run on the JS thread.

  tunerStart(): Promise<number>;
  tunerStop(): void;
  tunerSetTuning(
    instrument: CodegenTypes.Int32,
    stringMidis: readonly CodegenTypes.Int32[],
  ): Promise<number>;
  tunerSetTargetString(stringIndex: CodegenTypes.Int32): Promise<number>;
  tunerSetChromatic(): Promise<number>;
  tunerSetA4(a4Hz: CodegenTypes.Double): Promise<number>;
  tunerResetNotePresence(pauseMs: CodegenTypes.Double): Promise<number>;

  transportShow(state: TransportShowState): void;
  transportHide(): void;
  transportHandOver(): void;
  songTransportShow(state: SongTransportShowState): void;
  songTransportOrder(order: SongTransportOrder): void;
  songTransportHide(): void;
  setKeepScreenOn(on: boolean): void;
  setAppNightMode(mode: string): void;
  setSystemBarAppearance(light: boolean): void;
  readonly onTransport: CodegenTypes.EventEmitter<TransportEvent>;
  /** A stop from the song notification or media session; during a count-in it follows
   *  that onSongTransport stop. mixerStop() does not fire it. */
  readonly onSongStopped: CodegenTypes.EventEmitter<void>;
  /** The mixer played onto the song's last frame and stopped; read on the song card's tick, so it lags. */
  readonly onSongEnded: CodegenTypes.EventEmitter<void>;
  readonly onSongTransport: CodegenTypes.EventEmitter<SongTransportRequest>;
  getOutputRoute(): Promise<OutputRoute>;
  readonly onOutputRoute: CodegenTypes.EventEmitter<OutputRoute>;
  focusReaderView(viewTag: CodegenTypes.Int32): void;
}

// Lazy: resolving throws until the native module is registered, and the barrel
// re-exports this file, so an eager resolve would break importing a constant.
export function getKitbagCommands(): Spec {
  return TurboModuleRegistry.getEnforcing<Spec>('KitbagCommands');
}
