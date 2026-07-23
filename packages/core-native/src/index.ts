// core-native — the ONLY package that touches JSI/TurboModules (SPEC §13.1,
// §13.2). It installs the JSI HostObject once, holds the single kb_engine*,
// and is the only thing in the codebase that holds it.
//
// Constants are GENERATED from the engine source, never hand-mirrored (§13.7);
// see src/generated/nativeConstants.gen.ts.

// --- #29 (P2-A2) TurboModule command path (SPEC §13.2) -----------------------
export { default as KitbagCommands } from './NativeKitbagCommands';
export type { Spec as KitbagCommandsSpec } from './NativeKitbagCommands';

// --- #30 (P2-A3) JSI HostObject: polled realtime reads (§13.2, §13.3) --------
export {
  type KitbagHostObject,
  KITBAG_HOST_OBJECT_KEY,
  getKitbagHostObject,
} from './host/KitbagHostObject.ts';
export {
  type TunerReading,
  unpackTunerSnapshot,
  tunerNote,
  tunerCents,
  tunerConfidence,
} from './host/snapshot.ts';
export * from './generated/nativeConstants.gen.ts';
