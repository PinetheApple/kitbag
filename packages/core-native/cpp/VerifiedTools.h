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

namespace kitbag {

inline constexpr std::size_t kMaxPendingTools = 8;
inline constexpr std::size_t kMaxToolBytecodeBytes = std::size_t{32} << 20;

struct VerifiedBundle {
  std::vector<uint8_t> bytecode;
  uint32_t bytecodeVersion = 0;
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
  HandOffResult handOff(const std::string& toolId, VerifiedBundle bundle);
  std::optional<VerifiedBundle> take(std::string_view toolId);
  [[nodiscard]] std::size_t pendingCount() const;

 private:
  mutable std::mutex mutex_;
  std::map<std::string, VerifiedBundle, std::less<>> pending_;
};

[[nodiscard]] bool toolBytecodeFits(std::size_t bytes);
[[nodiscard]] std::optional<uint32_t> hbcVersion(
    std::span<const uint8_t> bytes
);
[[nodiscard]] BundleCheck
checkVerifiedBundle(const VerifiedBundle& bundle, uint32_t runtimeVersion);
VerifiedToolStore& verifiedTools();

}  // namespace kitbag

#endif  // KITBAG_VERIFIED_TOOLS_H
