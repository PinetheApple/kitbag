#include <cmath>

#include "metronome/metronome.h"
#include "metronome/metronome_internal.h"

namespace kitbag {

using metronome_detail::BarFraction;
using metronome_detail::Clamp;
using metronome_detail::kGridEpsilon;

namespace {

CountInStatus CountInAt(double counted_beats, int beats_per_bar, int total) {
  const auto bar = static_cast<int32_t>(
      std::floor(counted_beats / beats_per_bar + kGridEpsilon)
  );
  return {Clamp(bar, 0, total - 1), total};
}

}  // namespace

void Metronome::PublishTrainerMirrors(bool gridded, uint32_t sample_rate) {
  int32_t mute_position = -1;
  if (running_ && mute_enabled_ && current_bar_ >= 0) {
    mute_position =
        static_cast<int32_t>(current_bar_ % (play_bars_ + mute_bars_));
  }
  CountInStatus count_in;
  if (running_ && counting_in_) {
    count_in = CountInAt(
        beat_position_ + LatencyBeats() + count_in_beats_,
        beats_per_bar_,
        count_in_total_bars_
    );
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
  trainer_mirrors_.Publish(mute_position, count_in, ramp);
}

}  // namespace kitbag
