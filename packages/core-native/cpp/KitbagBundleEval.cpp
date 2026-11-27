#ifdef __ANDROID__

#include "KitbagBundleEval.h"

#include <android/asset_manager.h>

#include <cstddef>
#include <cstdint>
#include <cstring>
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
constexpr uint64_t kHbcMagic = 0x1F1903C103BC1FC6;
constexpr size_t kHbcVersionOffset = sizeof(kHbcMagic);

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

std::string locationArg(Runtime& rt, const Value* args, size_t count) {
  if (count < kArgCount || !args[0].isString()) throw JSError(rt, "expected (location)");
  return args[0].getString(rt).utf8(rt);
}

std::vector<uint8_t> readBundle(Runtime& rt, AAssetManager* assets, const std::string& location) {
  if (assets == nullptr && !location.starts_with(kFileScheme)) throw JSError(rt, "no asset manager for " + location);
  auto bytes = location.starts_with(kFileScheme) ? readFile(location.substr(kFileScheme.size()))
                                                 : readAsset(assets, location);
  if (!bytes) throw JSError(rt, "cannot read bundle " + location);
  return std::move(*bytes);
}

// Android ABIs are all little-endian, matching the hbc header's byte order.
double hbcVersion(Runtime& rt, const std::vector<uint8_t>& bytes, const std::string& location) {
  uint64_t magic = 0;
  uint32_t version = 0;
  if (bytes.size() < kHbcVersionOffset + sizeof(version)) throw JSError(rt, "too short for hbc " + location);
  std::memcpy(&magic, bytes.data(), sizeof(magic));
  if (magic != kHbcMagic) throw JSError(rt, "no hbc magic in " + location);
  std::memcpy(&version, bytes.data() + kHbcVersionOffset, sizeof(version));
  return static_cast<double>(version);
}

void setHostFunction(Runtime& rt, const char* key, facebook::jsi::HostFunctionType fn) {
  rt.global().setProperty(
      rt, key, Function::createFromHostFunction(rt, PropNameID::forAscii(rt, key), kArgCount, std::move(fn)));
}

}  // namespace

void installBundleEval(Runtime& rt, AAssetManager* assets) {
  setHostFunction(rt, kBundleEvalKey, [assets](Runtime& rt, const Value&, const Value* args, size_t count) {
    const std::string location = locationArg(rt, args, count);
    return rt.evaluateJavaScript(std::make_shared<OwnedBuffer>(readBundle(rt, assets, location)), location);
  });
  setHostFunction(rt, kHbcVersionKey, [assets](Runtime& rt, const Value&, const Value* args, size_t count) {
    const std::string location = locationArg(rt, args, count);
    return Value(hbcVersion(rt, readBundle(rt, assets, location), location));
  });
}

}  // namespace kitbag

#endif  // __ANDROID__
