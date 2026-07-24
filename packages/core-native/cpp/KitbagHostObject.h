// The JSI HostObject that fulfils src/host/KitbagHostObject.ts (SPEC §13.2).
//
// STATUS: SKELETON (#31). The native build is now wired — this compiles against
// jsi.h + kitbag_api.h and links kitbag_core (packages/core-native/android/
// CMakeLists.txt, KitbagCoreNative.podspec) — but it has NOT run inside a live RN
// runtime. The install into a real runtime and the on-device measurement are #33.
// Do not read compilation as verified behaviour. Every C ABI call below is
// declared against native/audio_core/include/kitbag_api.h (§13.7, no copy).
//
// Design invariant it exists to hold (SPEC §4.5, §13.2): the single kb_engine* is
// owned in exactly one place (KitbagEngine.cpp); this object borrows it to read.
// The sibling TurboModule (commands, #29) reaches the same engine through
// kitbagEngine(), never by owning a second pointer.

#ifndef KITBAG_HOST_OBJECT_H
#define KITBAG_HOST_OBJECT_H

#include <jsi/jsi.h>

#include <memory>
#include <vector>

struct kb_engine;

namespace kitbag {

// Global property name the object is installed under. Must equal
// KITBAG_HOST_OBJECT_KEY in src/host/KitbagHostObject.ts — one owner of the
// name, checked by eye until the two sides share a generated string.
inline constexpr const char* kHostObjectKey = "__KitbagHostObject";

// Synchronous polled reads into the C ABI (SPEC §13.2). Each read is a
// number-valued property: get() re-invokes the matching kb_* call and returns
// its value as a jsi double directly, allocating nothing per access — the 60fps
// requirement (SPEC §13.3). A callable would allocate a jsi::Function per frame,
// which that rule forbids. Frame counts (u64/i64) are exact to 2^53, no BigInt.
class KitbagHostObject : public facebook::jsi::HostObject {
 public:
  explicit KitbagHostObject(kb_engine* engine) : engine_(engine) {}

  facebook::jsi::Value get(
      facebook::jsi::Runtime& rt,
      const facebook::jsi::PropNameID& name) override;
  std::vector<facebook::jsi::PropNameID> getPropertyNames(
      facebook::jsi::Runtime& rt) override;

 private:
  // Borrowed pointer to the single engine, which KitbagEngine.cpp owns (§4.5).
  // This object never creates or destroys it.
  kb_engine* engine_;
};

// Installs the HostObject on `rt`'s global under kHostObjectKey, once, over an
// engine the caller already owns. The engine is created and owned by
// KitbagEngine.cpp's kitbagInstall(), which is the process-wide single owner
// (SPEC §4.5); the TurboModule command path borrows the same pointer via
// kitbagEngine(). This function does not create an engine.
void installKitbagHostObject(facebook::jsi::Runtime& rt, kb_engine* engine);

}  // namespace kitbag

#endif  // KITBAG_HOST_OBJECT_H
