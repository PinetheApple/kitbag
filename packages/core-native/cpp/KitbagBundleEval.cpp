#include "KitbagBundleEval.h"

#include <cstddef>
#include <cstdint>
#include <memory>
#include <vector>

namespace kitbag {

namespace {

using facebook::jsi::Function;
using facebook::jsi::JSError;
using facebook::jsi::PropNameID;
using facebook::jsi::Runtime;
using facebook::jsi::Value;

constexpr unsigned kArgCount = 2;

class OwnedBuffer final : public facebook::jsi::Buffer {
 public:
  OwnedBuffer(const uint8_t* data, size_t size) : bytes_(data, data + size) {}
  size_t size() const override { return bytes_.size(); }
  const uint8_t* data() const override { return bytes_.data(); }

 private:
  std::vector<uint8_t> bytes_;
};

Value evalBundle(Runtime& rt, const Value&, const Value* args, size_t count) {
  if (count < kArgCount || !args[0].isObject() || !args[1].isString()) {
    throw JSError(rt, "expected (ArrayBuffer, sourceUrl)");
  }
  auto bytes = args[0].getObject(rt);
  if (!bytes.isArrayBuffer(rt)) throw JSError(rt, "expected an ArrayBuffer");
  auto arrayBuffer = bytes.getArrayBuffer(rt);
  auto buffer = std::make_shared<OwnedBuffer>(arrayBuffer.data(rt), arrayBuffer.size(rt));
  return rt.evaluateJavaScript(buffer, args[1].getString(rt).utf8(rt));
}

}  // namespace

void installBundleEval(Runtime& rt) {
  rt.global().setProperty(
      rt, kBundleEvalKey,
      Function::createFromHostFunction(rt, PropNameID::forAscii(rt, kBundleEvalKey), kArgCount,
                                       evalBundle));
}

}  // namespace kitbag
