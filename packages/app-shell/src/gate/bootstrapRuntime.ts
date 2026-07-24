// Runtime install for the §13.3 60fps read path — staged for #33, NOT verified.
//
// THE CHOSEN MECHANISM (and why). `kitbagInstall(rt)` must make
// `global.__KitbagHostObject` resolve on the runtime the worklet reads. The
// worklet in useBeatSweep runs on the Reanimated UI runtime, whose `global` is a
// SEPARATE object from the RN JS runtime. Installing only on the JS runtime leaves
// the worklet reading `undefined` forever — the sweep silently holds at 0, no
// crash (this is the exact trap in useBeatSweep.ts's header and runbook §1).
//
// Rather than reach into react-native-worklets' internal C++ (WorkletsModuleProxy
// / RuntimeManager::getUIRuntime), which is unstable across worklets minor
// versions, this installs on the RN JS runtime natively (KitbagCommandsModule's
// constructor -> nativeInstall) and then re-publishes the SAME C++ HostObject onto
// the UI runtime from JS, using only worklets' public API:
//
//   - We capture the JS-runtime HostObject value into a worklet and assign it to
//     the UI runtime's global. When worklets serialises the captured value it
//     hits its host-object branch (verified by reading react-native-worklets
//     Common/cpp/worklets/SharedItems/Serializable.cpp @ v0.7.4: a foreign
//     jsi::HostObject is wrapped as `SerializableHostObject`, which on the target
//     runtime reconstructs via `jsi::Object::createFromHostObject` sharing the
//     SAME underlying C++ object). So the UI runtime gets a reference to the one
//     KitbagHostObject holding the one kb_engine* (SPEC §4.5) — not a copy, not a
//     second engine. This is the same shape Reanimated uses to share its own
//     SharedValue host objects onto the UI runtime.
//
// UNCERTAINTY, to be settled by the device build (do not read as proven):
//   1. That worklets v0.7.4 actually takes the SerializableHostObject branch for
//      our HostObject at capture time (source says yes; runtime says nothing yet).
//   2. That KitbagCommandsModule's constructor installed on the JS runtime before
//      this runs (getKitbagCommands() forces construction synchronously on the JS
//      thread, so getKitbagHostObject() below should find it — unverified).
//   3. The native runtime-pointer plumbing under bridgeless New Arch (see
//      KitbagCommandsModule.kt).
// The #33 assertion is that values CHANGE on device — a "nothing threw" run can
// still be a wrong-runtime (frozen) install.

import {
  getKitbagCommands,
  getKitbagHostObject,
  KITBAG_HOST_OBJECT_KEY,
  type KitbagHostObject,
} from '@kitbag/core-native';
import { runOnUISync } from 'react-native-worklets';

// Keyed off the single owned host key (§13.7) — never a retyped literal.
type HostGlobal = Record<
  typeof KITBAG_HOST_OBJECT_KEY,
  KitbagHostObject | undefined
>;

let installed = false;

/**
 * Install the HostObject on both runtimes, once. Human-speed setup (runs on a
 * tap / first mount), NOT a frame driver — it must never be on the 60fps path.
 * Throws if the native module is not registered (no native build), so callers
 * guard it; the gate still renders without native, holding the sweep at 0.
 */
export function bootstrapKitbagRuntime(): void {
  if (installed) {
    return;
  }

  // (1) Forcing TurboModule resolution constructs KitbagCommandsModule, whose
  //     constructor installs the HostObject on the RN JS runtime. Throws until
  //     the module is registered (#33). Also the command surface GateScreen
  //     drives the engine with.
  getKitbagCommands();

  // (2) Re-publish the SAME C++ HostObject onto the Reanimated UI runtime, where
  //     the worklet reads. See the header for why this shares one engine.
  const host = getKitbagHostObject(); // the JS-runtime instance from step (1)
  runOnUISync(() => {
    'worklet';
    (globalThis as unknown as HostGlobal)[KITBAG_HOST_OBJECT_KEY] = host;
  });

  installed = true;
}
