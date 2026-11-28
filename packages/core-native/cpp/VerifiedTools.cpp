#include "VerifiedTools.h"

#include <algorithm>
#include <utility>

namespace kitbag {

namespace {

constexpr unsigned kBitsPerByte = 8;
static_assert(kHbcVersionBytes <= sizeof(uint32_t));

}  // namespace

HandOffResult
VerifiedToolStore::HandOff(const std::string& tool_id, VerifiedBundle bundle) {
  if (!ToolBytecodeFits(bundle.bytecode.size())) {
    return HandOffResult::kTooLarge;
  }
  const std::lock_guard lock(mutex_);
  auto existing = pending_.find(tool_id);
  if (existing != pending_.end()) {
    existing->second = std::move(bundle);
    return HandOffResult::kStored;
  }
  if (pending_.size() >= kMaxPendingTools) return HandOffResult::kStoreFull;
  pending_.emplace(tool_id, std::move(bundle));
  return HandOffResult::kStored;
}

std::optional<VerifiedBundle> VerifiedToolStore::Take(
    std::string_view tool_id
) {
  const std::lock_guard lock(mutex_);
  auto found = pending_.find(tool_id);
  if (found == pending_.end()) return std::nullopt;
  VerifiedBundle bundle = std::move(found->second);
  pending_.erase(found);
  return bundle;
}

bool VerifiedToolStore::Drop(std::string_view tool_id) {
  return Take(tool_id).has_value();
}

std::size_t VerifiedToolStore::pending_count() const {
  const std::lock_guard lock(mutex_);
  return pending_.size();
}

bool ToolBytecodeFits(std::size_t bytes) {
  return bytes <= kMaxToolBytecodeBytes;
}

std::optional<uint32_t> HbcVersion(std::span<const uint8_t> bytes) {
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
CheckVerifiedBundle(const VerifiedBundle& bundle, uint32_t runtime_version) {
  const auto header = HbcVersion(bundle.bytecode);
  if (!header) return BundleCheck::kNotHermesBytecode;
  if (bundle.bytecode_version != runtime_version) {
    return BundleCheck::kManifestVersionMismatch;
  }
  if (*header != runtime_version) return BundleCheck::kBytecodeVersionMismatch;
  return BundleCheck::kOk;
}

VerifiedToolStore& VerifiedTools() {
  static VerifiedToolStore store;
  return store;
}

}  // namespace kitbag
