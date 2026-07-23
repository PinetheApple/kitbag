// The JSI HostObject that fulfils src/host/KitbagHostObject.ts (SPEC §13.2).
//
// STATUS: UNCOMPILED SCAFFOLDING. No native build is wired until #31 — there is
// no jsi/jsi.h on any include path here and nothing compiles or links this. It
// is committed as the contract skeleton, not as verified behaviour: do not read
// it as "working". Every C ABI call below is declared against
// native/audio_core/include/kitbag_api.h but has run nowhere.
//
// Design invariant it exists to hold (SPEC §4.5, §13.2): this object is THE ONLY
// holder of the single kb_engine*. The sibling TurboModule (commands, #29) must
// reach the engine through core-native, never by owning a second pointer.

#ifndef KITBAG_HOST_OBJECT_H
#define KITBAG_HOST_OBJECT_H

#include <jsi/jsi.h>

#include <memory>
#include <vector>

struct kb_engine;

namespace kitbag {

// Global property name the object is installed under. Must equal
// KITBAG_HOST_OBJECT_KEY in src/host/KitbagHostObject.ts — one owner of the
// name, checked by eye until the two sides share a generated string (TODO #31).
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
  // The single engine pointer, owned nowhere else in the codebase (SPEC §4.5).
  kb_engine* engine_;
};

// Installs the HostObject on `rt`'s global under kHostObjectKey, once. The
// engine is created and owned here; the TurboModule borrows it via core-native,
// it does not create its own (SPEC §13.2). TODO #31: wire creation + the shared
// accessor the TurboModule reads.
void installKitbagHostObject(facebook::jsi::Runtime& rt, kb_engine* engine);

}  // namespace kitbag

#endif  // KITBAG_HOST_OBJECT_H
