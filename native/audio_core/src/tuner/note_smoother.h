#ifndef KITBAG_TUNER_NOTE_SMOOTHER_H
#define KITBAG_TUNER_NOTE_SMOOTHER_H

// Per-hop pitch smoothing for one held note, in fractional MIDI: the P8
// blend-or-replace follower and the P9 median that a released note holds.
#include <array>

#include "tuner/tuning_rules.h"

namespace kitbag {

class NoteSmoother {
 public:
  void Reset();
  void Add(double midi);

  bool empty() const {
    return count_ == 0;
  }
  double smoothed() const {
    return smoothed_;
  }
  // Median of the last kMedianLength raw estimates (fewer before that many).
  double held() const;

 private:
  std::array<double, tuning_rules::kMedianLength> recent_{};
  int count_ = 0;
  int next_ = 0;
  double smoothed_ = 0.0;
};

}  // namespace kitbag

#endif  // KITBAG_TUNER_NOTE_SMOOTHER_H
