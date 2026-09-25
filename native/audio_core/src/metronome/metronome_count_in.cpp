#include <cmath>

#include "metronome/metronome.h"
#include "metronome/metronome_internal.h"

namespace kitbag {

using metronome_detail::IsOneOf;
using metronome_detail::kGridEpsilon;

void Metronome::SetCountInState(const Command& command) {
  if (IsOneOf(kCountInBarChoices, command.int_a)) {
    count_in_bars_ = command.int_a;
  }
  count_in_distinct_ = command.int_b != 0;
  if (command.int_c >= 0 && command.int_c < kSoundCount) {
    count_in_sound_ = command.int_c;
  }
}

void Metronome::PauseRun() {
  const bool armed = count_in_armed_;
  StopRun();
  count_in_armed_ = armed;
}

void Metronome::ArmCountIn() {
  counting_in_ = count_in_armed_ && count_in_bars_ > 0;
  count_in_armed_ = false;
  count_in_beats_ =
      counting_in_ ? static_cast<double>(count_in_bars_ * beats_per_bar_) : 0.0;
}

void Metronome::CancelCountIn() {
  beat_position_ += count_in_beats_;
  counting_in_ = false;
  count_in_beats_ = 0.0;
}

void Metronome::AdvanceCountIn(
    double position,
    const BlockTempo& tempo,
    uint32_t sample_rate
) {
  if (position >= -kGridEpsilon) {
    counting_in_ = false;
    return;
  }
  const auto beat = static_cast<int64_t>(std::floor(position + kGridEpsilon));
  if (position - tempo.beats_per_sample <
      static_cast<double>(beat) - kGridEpsilon) {
    OnCountInBeat(beat, sample_rate);
  }
}

void Metronome::OnCountInBeat(int64_t beat, uint32_t sample_rate) {
  const auto index = static_cast<int32_t>(
      (beat % beats_per_bar_ + beats_per_bar_) % beats_per_bar_
  );
  current_beat_.store(index, std::memory_order_relaxed);
  const bool downbeat = index == 0;
  if (count_in_distinct_) {
    TriggerPreset(count_in_sound_, downbeat, sample_rate);
  } else {
    TriggerPreset(
        downbeat ? accent_sound_ : normal_sound_,
        downbeat,
        sample_rate
    );
  }
}

}  // namespace kitbag
