// Write path only; 60fps reads go through the JSI HostObject (SPEC §13.3).
// Frame arguments are uint64 engine frames as doubles, exact below 2^53.

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { Double, Int32 } from 'react-native/Libraries/Types/CodegenTypes';

export interface Spec extends TurboModule {
  start(): Promise<number>;
  stop(): void;

  metronomeStart(anchorFrame: Double): void;
  metronomeStop(): void;
  metronomePause(): void;

  setTempo(bpm: Double): void;
  setGrid(
    beatTimesSec: readonly Double[],
    anchorFrame: Double,
  ): Promise<number>;

  setBeats(beatsPerBar: Int32, denominator: Int32): void;
  setSubdivision(subdivision: Int32): void;
  setAccent(beatIndex: Int32, accent: Int32): void;
  setPoly(enabled: boolean, beats: Int32): void;
  setPolyAccent(beatIndex: Int32, accent: Int32): void;
  setSounds(normalSound: Int32, accentSound: Int32): void;
  previewSound(sound: Int32, accented: boolean): void;
  setCountIn(bars: Int32, distinct: boolean, sound: Int32): void;
  setVolume(volume: Double): void;
  setLatencyOffset(latencyMs: Double): void;

  setRamp(
    enabled: boolean,
    startBpm: Double,
    endBpm: Double,
    duration: Double,
    unit: Int32,
    loop: boolean,
  ): void;
  setBarMute(enabled: boolean, playBars: Int32, muteBars: Int32): void;

  loadTrack(track: Int32, path: string): Promise<number>;
}

// Lazy: resolving throws until the native module is registered, and the barrel
// re-exports this file, so an eager resolve would break importing a constant.
export function getKitbagCommands(): Spec {
  return TurboModuleRegistry.getEnforcing<Spec>('KitbagCommands');
}
