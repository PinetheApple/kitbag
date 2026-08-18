// The subset of the core-native TurboModule the metronome store dispatches to.
// core-state is the concrete DI layer (SPEC §13.1): the store is INTENT, every
// mutation issues the matching engine command; the engine is TRUTH. Only
// core-native touches JSI/TurboModules (§13.2) — the store reaches them through
// this typed handle, which the factory injects so tests can spy the 1:1 mapping.

import {
  getKitbagCommands,
  getKitbagHostObject,
  type KitbagCommandsSpec,
} from '@kitbag/core-native';

// Pick, not restate (§13.7): the command signatures have exactly one owner, the
// TurboModule Spec. Narrowing to what the metronome uses keeps a stub honest —
// it cannot drift from the real command shapes.
export type MetronomeCommands = Pick<
  KitbagCommandsSpec,
  | 'start'
  | 'metronomeStart'
  | 'metronomeStop'
  | 'setTempo'
  | 'setBeats'
  | 'setSubdivision'
  | 'setAccent'
  | 'setPoly'
  | 'setSound'
  | 'setVolume'
  | 'setLatencyOffset'
  | 'setRamp'
  | 'setBarMute'
>;

/**
 * The engine frame to anchor a metronome start on. A ONE-SHOT human-speed read
 * of frames_rendered ("now"), never held — the store keeps no realtime value
 * (§13.3). Injected so the factory is testable without a native runtime.
 */
export type NowFrame = () => number;

// Default wiring for the production singleton. Resolved lazily on first call:
// the native module is not registered at import time (skeleton, #31), so
// resolving eagerly would throw for any importer of core-state.
export const defaultCommands: MetronomeCommands = {
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
};

export const defaultNowFrame: NowFrame = () =>
  getKitbagHostObject().frames_rendered;
