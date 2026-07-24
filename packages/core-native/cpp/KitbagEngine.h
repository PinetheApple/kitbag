// Process-wide ownership of the single kb_engine* (SPEC §4.5) and the JSI
// install entrypoint.
//
// SKELETON (#31): compiled and linked by packages/core-native/android/
// CMakeLists.txt and packages/core-native/KitbagCoreNative.podspec against the
// real kitbag_core. It is NOT yet installed into a running RN runtime — that
// final link (and the on-device measurement it enables) is #33's job.
//
// SPEC §4.5 / §13.3: there is exactly ONE kb_engine* in the process. core-native
// owns it here; the JSI HostObject (polled realtime reads, §13.3) and the
// TurboModule command path (§13.2) both BORROW it through kitbagEngine(). Neither
// creates a second engine — that single-owner invariant is what the realtime
// design rests on, and it lives in exactly one package (§13.1).

#ifndef KITBAG_ENGINE_H
#define KITBAG_ENGINE_H

#include <jsi/jsi.h>

struct kb_engine;

namespace kitbag {

// The single engine pointer, or nullptr before kitbagInstall() has run. Callers
// borrow it and must never destroy it (SPEC §4.5).
kb_engine* kitbagEngine();

// Creates the one engine (once) and installs the JSI HostObject on `rt`.
//
// SKELETON (#31). DEFERRED to Phase 3 (§13.9): engine create/destroy must be tied
// to the Android foreground-service lifecycle, not first JS load, and
// kb_engine_create's kb_result must be surfaced rather than dropped. As written
// it creates lazily and never destroys.
void kitbagInstall(facebook::jsi::Runtime& rt);

}  // namespace kitbag

#endif  // KITBAG_ENGINE_H
