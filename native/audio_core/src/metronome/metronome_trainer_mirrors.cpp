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
  return {Clamp(bar, 0, total - 1), total, true};
}

}  // namespace

void Metronome::PublishTrainerMirrors(bool gridded, uint32_t sample_rate) {
  BarMuteStatus bar_mute;
  bar_mute.muted = running_ && BarIsMuted(current_bar_);
  if (running_ && mute_enabled_ && current_bar_ >= 0) {
    bar_mute.position =
        static_cast<int32_t>(current_bar_ % (play_bars_ + mute_bars_));
  }
  const double fired =
      LastSoundedPosition(BlockTempoFor(sample_rate).beats_per_sample);
  CountInStatus count_in;
  if (running_ && counting_in_) {
    count_in = CountInAt(
        fired + count_in_beats_,
        beats_per_bar_,
        count_in_total_bars_
    );
  }
  RampStatus ramp;
  if (running_ && !gridded) {
    ramp = ramp_.Status(
        current_bar_,
        BarFraction(fired, beats_per_bar_),
        sample_rate
    );
  }
  trainer_mirrors_.Publish(bar_mute, count_in, ramp);
}

}  // namespace kitbag
