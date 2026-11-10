#ifndef KITBAG_METRONOME_COUNT_IN_SCHEDULE_H
#define KITBAG_METRONOME_COUNT_IN_SCHEDULE_H

#include <algorithm>
#include <cstdint>

#include "metronome/trainer_mirrors.h"

namespace kitbag {

struct CountInVoice {
  int sound = 0;
  bool distinct = true;
};

// RT-owned. Placed from the end so no spacing error adds up.
class CountInSchedule {
 public:
  static constexpr int kNoBeat = -1;
  // Each beat then rounds to its own frame.
  static constexpr double kMinBeatFrames = 1.0;

  void Arm(
      uint64_t end_frame,
      double beat_frames,
      int beats_per_bar,
      int bars,
      CountInVoice voice
  ) {
    end_frame_ = end_frame;
    beat_frames_ = beat_frames;
    beats_per_bar_ = beats_per_bar;
    bars_ = bars;
    voice_ = voice;
    left_ = bars * beats_per_bar;
    armed_ = bars > 0;
  }
  void Clear() {
    armed_ = false;
  }
  bool armed() const {
    return armed_;
  }
  CountInVoice voice() const {
    return voice_;
  }

  int BeatAt(uint64_t now) {
    const auto frame = static_cast<double>(now);
    while (left_ > 0 && FrameOf(left_) < frame - kHalfFrame) --left_;
    if (left_ == 0 || FrameOf(left_) >= frame + kHalfFrame) return kNoBeat;
    const int ordinal = Total() - left_;
    --left_;
    return ordinal % beats_per_bar_;
  }

  CountInStatus Status() const {
    const int last = std::max(Total() - left_ - 1, 0);
    return {
        .bar = last / beats_per_bar_,
        .bars_total = bars_,
        .counting = true
    };
  }

 private:
  static constexpr double kHalfFrame = 0.5;

  int Total() const {
    return bars_ * beats_per_bar_;
  }
  double FrameOf(int k) const {
    return static_cast<double>(end_frame_) - k * beat_frames_;
  }

  uint64_t end_frame_ = 0;
  double beat_frames_ = 1.0;
  int beats_per_bar_ = 1;
  int bars_ = 0;
  int left_ = 0;
  CountInVoice voice_;
  bool armed_ = false;
};

}  // namespace kitbag

#endif  // KITBAG_METRONOME_COUNT_IN_SCHEDULE_H
