#ifdef __ANDROID__

#include "KitbagBundleEval.h"

#include <android/asset_manager.h>

#include <cstddef>
#include <cstdint>
#include <fstream>
#include <iterator>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace kitbag {

namespace {

using facebook::jsi::Function;
using facebook::jsi::JSError;
using facebook::jsi::PropNameID;
using facebook::jsi::Runtime;
using facebook::jsi::Value;

constexpr unsigned kArgCount = 1;
constexpr std::string_view kFileScheme = "file://";

class OwnedBuffer final : public facebook::jsi::Buffer {
 public:
  explicit OwnedBuffer(std::vector<uint8_t> bytes) : bytes_(std::move(bytes)) {}
  size_t size() const override { return bytes_.size(); }
  const uint8_t* data() const override { return bytes_.data(); }

 private:
  std::vector<uint8_t> bytes_;
};

std::optional<std::vector<uint8_t>> readFile(const std::string& path) {
  std::ifstream in(path, std::ios::binary);
  if (!in) return std::nullopt;
  return std::vector<uint8_t>(std::istreambuf_iterator<char>(in), {});
}

std::optional<std::vector<uint8_t>> readAsset(AAssetManager* assets, const std::string& name) {
  AAsset* asset = AAssetManager_open(assets, name.c_str(), AASSET_MODE_BUFFER);
  if (asset == nullptr) return std::nullopt;
  const auto* start = static_cast<const uint8_t*>(AAsset_getBuffer(asset));
  std::optional<std::vector<uint8_t>> bytes;
  if (start != nullptr) bytes.emplace(start, start + AAsset_getLength64(asset));
  AAsset_close(asset);
  return bytes;
}

}  // namespace

void installBundleEval(Runtime& rt, AAssetManager* assets) {
  auto evalBundle = [assets](Runtime& rt, const Value&, const Value* args, size_t count) {
    if (count < kArgCount || !args[0].isString()) throw JSError(rt, "expected (location)");
    const std::string location = args[0].getString(rt).utf8(rt);
    auto bytes = location.starts_with(kFileScheme)
                     ? readFile(location.substr(kFileScheme.size()))
                     : readAsset(assets, location);
    if (!bytes) throw JSError(rt, "cannot read bundle " + location);
    return rt.evaluateJavaScript(std::make_shared<OwnedBuffer>(std::move(*bytes)), location);
  };
  rt.global().setProperty(
      rt, kBundleEvalKey,
      Function::createFromHostFunction(rt, PropNameID::forAscii(rt, kBundleEvalKey), kArgCount,
                                       std::move(evalBundle)));
}

}  // namespace kitbag

#endif  // __ANDROID__
