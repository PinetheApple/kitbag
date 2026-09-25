import { getKitbagCommands, getKitbagHostObject } from '@kitbag/core-native';

import type { EngineBpm, MetronomeCommands, NowFrame } from './commands.ts';

export interface MetronomeRuntime {
  readonly commands: MetronomeCommands;
  readonly nowFrame: NowFrame;
  readonly engineBpm: EngineBpm;
}

const nativeRuntime: MetronomeRuntime = {
  get commands() {
    return getKitbagCommands();
  },
  nowFrame: () => getKitbagHostObject().frames_rendered,
  engineBpm: () => getKitbagHostObject().current_bpm,
};

let configuredRuntime: MetronomeRuntime | undefined;

export function configureMetronomeRuntime(runtime: MetronomeRuntime): void {
  if (configuredRuntime === undefined) {
    configuredRuntime = runtime;
    return;
  }
  if (configuredRuntime !== runtime) {
    throw new Error('Metronome runtime is already configured');
  }
}

export function getMetronomeRuntime(): MetronomeRuntime {
  return configuredRuntime ?? nativeRuntime;
}
