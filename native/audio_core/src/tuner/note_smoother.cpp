#include "tuner/note_smoother.h"

#include <algorithm>
#include <cmath>

namespace kitbag {

void NoteSmoother::Reset() {
  count_ = 0;
  next_ = 0;
  smoothed_ = 0.0;
}

void NoteSmoother::Add(double midi) {
  const double jump_cents =
      std::fabs(midi - smoothed_) * tuning_rules::kCentsPerSemitone;
  if (count_ == 0 || jump_cents > tuning_rules::kBlendLimitCents) {
    smoothed_ = midi;
  } else {
    smoothed_ += tuning_rules::kBlendNewWeight * (midi - smoothed_);
  }
  recent_[static_cast<size_t>(next_)] = midi;
  next_ = (next_ + 1) % tuning_rules::kMedianLength;
  count_ = std::min(count_ + 1, tuning_rules::kMedianLength);
}

double NoteSmoother::held() const {
  std::array<double, tuning_rules::kMedianLength> sorted = recent_;
  const auto end = sorted.begin() + count_;
  const auto middle = sorted.begin() + count_ / 2;
  std::nth_element(sorted.begin(), middle, end);
  return count_ == 0 ? 0.0 : *middle;
}

}  // namespace kitbag
