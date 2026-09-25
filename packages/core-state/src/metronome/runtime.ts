import { getKitbagCommands, getKitbagHostObject } from '@kitbag/core-native';

import { type MetronomeCommands, type NowFrame } from './commands.ts';

export interface MetronomeRuntime {
  readonly commands: MetronomeCommands;
  readonly nowFrame: NowFrame;
}

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

const nativeRuntime: MetronomeRuntime = {
  commands: {
    start: (...args) => getKitbagCommands().start(...args),
    metronomeStart: (...args) => {
      getKitbagCommands().metronomeStart(...args);
    },
    metronomeStop: (...args) => {
      getKitbagCommands().metronomeStop(...args);
    },
    setTempo: (...args) => {
      getKitbagCommands().setTempo(...args);
    },
    setBeats: (...args) => {
      getKitbagCommands().setBeats(...args);
    },
    setSubdivision: (...args) => {
      getKitbagCommands().setSubdivision(...args);
    },
    setAccent: (...args) => {
      getKitbagCommands().setAccent(...args);
    },
    setPoly: (...args) => {
      getKitbagCommands().setPoly(...args);
    },
    setSound: (...args) => {
      getKitbagCommands().setSound(...args);
    },
    setVolume: (...args) => {
      getKitbagCommands().setVolume(...args);
    },
    setLatencyOffset: (...args) => {
      getKitbagCommands().setLatencyOffset(...args);
    },
    setRamp: (...args) => {
      getKitbagCommands().setRamp(...args);
    },
    setBarMute: (...args) => {
      getKitbagCommands().setBarMute(...args);
    },
  },
  nowFrame: () => getKitbagHostObject().frames_rendered,
};
