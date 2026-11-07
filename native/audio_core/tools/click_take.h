#ifndef KITBAG_TOOLS_CLICK_TAKE_H
#define KITBAG_TOOLS_CLICK_TAKE_H

#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <vector>

namespace click_take {

constexpr float kSilence = 1e-2f;
constexpr int64_t kGapFrames = 480;
constexpr int kMaxShownClicks = 4;

// A voice starts at phase zero, so its trigger frame is the silent one before
// the first audible sample.
inline std::vector<int64_t> DetectClicks(const std::vector<float>& channel) {
  std::vector<int64_t> clicks;
  int64_t quiet = kGapFrames;
  for (size_t k = 0; k < channel.size(); ++k) {
    if (std::fabs(channel[k]) <= kSilence) {
      ++quiet;
      continue;
    }
    if (quiet >= kGapFrames) clicks.push_back(static_cast<int64_t>(k) - 1);
    quiet = 0;
  }
  return clicks;
}

inline bool
SameClicks(const std::vector<int64_t>& got, const std::vector<int64_t>& want) {
  bool same = got.size() == want.size();
  int shown = 0;
  for (size_t i = 0; i < got.size() && i < want.size(); ++i) {
    if (got[i] == want[i]) continue;
    same = false;
    if (++shown > kMaxShownClicks) continue;
    std::fprintf(
        stderr,
        "  click %zu at %lld, expected %lld\n",
        i,
        static_cast<long long>(got[i]),
        static_cast<long long>(want[i])
    );
  }
  if (got.size() != want.size()) {
    std::fprintf(
        stderr,
        "  %zu clicks, expected %zu\n",
        got.size(),
        want.size()
    );
  }
  return same;
}

}  // namespace click_take

#endif  // KITBAG_TOOLS_CLICK_TAKE_H
