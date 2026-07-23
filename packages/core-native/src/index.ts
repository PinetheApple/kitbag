// core-native — the ONLY package that touches JSI/TurboModules (SPEC §13.1,
// §13.2). It installs the JSI HostObject once, holds the single kb_engine*,
// and is the only thing in the codebase that holds it.
//
// SKELETON (#27): no binding exists yet. The TurboModule (commands) and the
// JSI HostObject (polled realtime reads) land in later Phase 2 waves. Nothing
// here may be hand-mirrored from the C ABI header (§13.7) — constants are
// generated from the header or exposed through the TurboModule when that work
// begins. This placeholder only anchors the package boundary.

// --- #29 (P2-A2) TurboModule command path (SPEC §13.2) -----------------------
export { default as KitbagCommands } from './NativeKitbagCommands';
export type { Spec as KitbagCommandsSpec } from './NativeKitbagCommands';
