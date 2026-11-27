#include "VerifiedTools.h"

#include <algorithm>
#include <array>
#include <utility>

namespace kitbag {

namespace {

constexpr std::array<uint8_t, 8> kHbcMagic =
    {0xc6, 0x1f, 0xbc, 0x03, 0xc1, 0x03, 0x19, 0x1f};
constexpr std::size_t kHbcVersionBytes = sizeof(uint32_t);
constexpr unsigned kBitsPerByte = 8;

}  // namespace

HandOffResult
VerifiedToolStore::handOff(const std::string& toolId, VerifiedBundle bundle) {
  if (!toolBytecodeFits(bundle.bytecode.size())) {
    return HandOffResult::kTooLarge;
  }
  const std::lock_guard lock(mutex_);
  auto existing = pending_.find(toolId);
  if (existing != pending_.end()) {
    existing->second = std::move(bundle);
    return HandOffResult::kStored;
  }
  if (pending_.size() >= kMaxPendingTools) return HandOffResult::kStoreFull;
  pending_.emplace(toolId, std::move(bundle));
  return HandOffResult::kStored;
}

std::optional<VerifiedBundle> VerifiedToolStore::take(std::string_view toolId) {
  const std::lock_guard lock(mutex_);
  auto found = pending_.find(toolId);
  if (found == pending_.end()) return std::nullopt;
  VerifiedBundle bundle = std::move(found->second);
  pending_.erase(found);
  return bundle;
}

std::size_t VerifiedToolStore::pendingCount() const {
  const std::lock_guard lock(mutex_);
  return pending_.size();
}

bool toolBytecodeFits(std::size_t bytes) {
  return bytes <= kMaxToolBytecodeBytes;
}

std::optional<uint32_t> hbcVersion(std::span<const uint8_t> bytes) {
  if (bytes.size() < kHbcMagic.size() + kHbcVersionBytes) return std::nullopt;
  if (!std::equal(kHbcMagic.begin(), kHbcMagic.end(), bytes.begin())) {
    return std::nullopt;
  }
  uint32_t version = 0;
  for (std::size_t i = 0; i < kHbcVersionBytes; ++i) {
    version |= uint32_t{bytes[kHbcMagic.size() + i]} << (i * kBitsPerByte);
  }
  return version;
}

BundleCheck
checkVerifiedBundle(const VerifiedBundle& bundle, uint32_t runtimeVersion) {
  const auto header = hbcVersion(bundle.bytecode);
  if (!header) return BundleCheck::kNotHermesBytecode;
  if (bundle.bytecodeVersion != runtimeVersion) {
    return BundleCheck::kManifestVersionMismatch;
  }
  if (*header != runtimeVersion) return BundleCheck::kBytecodeVersionMismatch;
  return BundleCheck::kOk;
}

VerifiedToolStore& verifiedTools() {
  static VerifiedToolStore store;
  return store;
}

}  // namespace kitbag
