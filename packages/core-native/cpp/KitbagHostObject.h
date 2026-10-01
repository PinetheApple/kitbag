#ifndef KITBAG_HOST_OBJECT_H
#define KITBAG_HOST_OBJECT_H

#include <jsi/jsi.h>

#include <memory>
#include <vector>

struct kb_engine;

namespace kitbag {

// Must equal KITBAG_HOST_OBJECT_KEY in src/host/KitbagHostObject.ts.
inline constexpr const char* kHostObjectKey = "__KitbagHostObject";

// Number-valued properties, not methods: a callable would allocate a
// jsi::Function per worklet frame (SPEC §13.3).
class KitbagHostObject : public facebook::jsi::HostObject {
 public:
  explicit KitbagHostObject(kb_engine* engine) : engine_(engine) {}

  facebook::jsi::Value get(
      facebook::jsi::Runtime& rt,
      const facebook::jsi::PropNameID& name) override;
  std::vector<facebook::jsi::PropNameID> getPropertyNames(
      facebook::jsi::Runtime& rt) override;

 private:
  kb_engine* engine_;
};

void installKitbagHostObject(facebook::jsi::Runtime& rt, kb_engine* engine);

}  // namespace kitbag

#endif  // KITBAG_HOST_OBJECT_H
