#ifndef KITBAG_VERIFIED_TOOLS_H
#define KITBAG_VERIFIED_TOOLS_H

#include <cstddef>
#include <cstdint>
#include <functional>
#include <map>
#include <mutex>
#include <optional>
#include <span>
#include <string>
#include <string_view>
#include <vector>

#include "ToolBundleRules.gen.h"

namespace kitbag {

inline constexpr std::size_t kMaxPendingTools = 8;
// bundle.hbc is a zip entry, and Kotlin refuses any entry inflating past this.
inline constexpr std::size_t kMaxToolBytecodeBytes = kInflatedMaxBytes;

struct VerifiedBundle {
  std::vector<uint8_t> bytecode;
  uint32_t bytecode_version = 0;
};

enum class HandOffResult { kStored, kTooLarge, kStoreFull };

enum class BundleCheck {
  kOk,
  kNotHermesBytecode,
  kManifestVersionMismatch,
  kBytecodeVersionMismatch,
};

class VerifiedToolStore {
 public:
  HandOffResult HandOff(const std::string& tool_id, VerifiedBundle bundle);
  std::optional<VerifiedBundle> Take(std::string_view tool_id);
  bool Drop(std::string_view tool_id);
  [[nodiscard]] std::size_t pending_count() const;

 private:
  mutable std::mutex mutex_;
  std::map<std::string, VerifiedBundle, std::less<>> pending_;
};

[[nodiscard]] bool ToolBytecodeFits(std::size_t bytes);
[[nodiscard]] std::optional<uint32_t> HbcVersion(
    std::span<const uint8_t> bytes
);
[[nodiscard]] BundleCheck
CheckVerifiedBundle(const VerifiedBundle& bundle, uint32_t runtime_version);
VerifiedToolStore& VerifiedTools();

}  // namespace kitbag

#endif  // KITBAG_VERIFIED_TOOLS_H
