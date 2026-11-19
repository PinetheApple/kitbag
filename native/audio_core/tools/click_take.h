#ifndef KITBAG_TOOLS_CLICK_TAKE_H
#define KITBAG_TOOLS_CLICK_TAKE_H

#include <algorithm>
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
class ClickStream {
 public:
  void Feed(float sample) {
    const int64_t frame = frame_++;
    if (std::fabs(sample) <= kSilence) {
      ++quiet_;
      return;
    }
    if (quiet_ >= kGapFrames) clicks_.push_back(frame - 1);
    quiet_ = 0;
  }
  const std::vector<int64_t>& clicks() const {
    return clicks_;
  }

 private:
  int64_t frame_ = 0;
  int64_t quiet_ = kGapFrames;
  std::vector<int64_t> clicks_;
};

inline std::vector<int64_t> DetectClicks(const std::vector<float>& channel) {
  ClickStream stream;
  for (float sample : channel) stream.Feed(sample);
  return stream.clicks();
}

inline float Peak(const std::vector<float>& channel, size_t from, size_t to) {
  float peak = 0.0f;
  for (size_t k = from; k < to && k < channel.size(); ++k) {
    peak = std::max(peak, std::fabs(channel[k]));
  }
  return peak;
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
