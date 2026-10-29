#include <cmath>

#include "metronome/metronome.h"
#include "metronome/metronome_internal.h"

namespace kitbag {

using metronome_detail::BarFraction;
using metronome_detail::Clamp;
using metronome_detail::kGridEpsilon;

void Metronome::PublishTrainerMirrors(bool gridded, uint32_t sample_rate) {
  int32_t mute_position = -1;
  if (running_ && mute_enabled_ && current_bar_ >= 0) {
    mute_position =
        static_cast<int32_t>(current_bar_ % (play_bars_ + mute_bars_));
  }
  int32_t count_in_bar = -1;
  if (running_ && counting_in_) {
    const double counted = beat_position_ + LatencyBeats() + count_in_beats_;
    const auto bar = static_cast<int32_t>(
        std::floor(counted / beats_per_bar_ + kGridEpsilon)
    );
    count_in_bar = Clamp(bar, 0, count_in_bars_ - 1);
  }
  RampStatus ramp;
  if (running_ && !gridded) {
    // bar_phase_ is one sample ahead of current_bar_; read the frame just fired.
    const double fired = beat_position_ + LatencyBeats() -
                         BlockTempoFor(sample_rate).beats_per_sample;
    ramp = ramp_.Status(
        current_bar_,
        BarFraction(fired, beats_per_bar_),
        sample_rate
    );
  }
  trainer_mirrors_.Publish(mute_position, count_in_bar, ramp);
}

}  // namespace kitbag
