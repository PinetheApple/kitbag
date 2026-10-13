#include "tuner/wrong_string_hint.h"

#include <cmath>

#include "tuner/tuning_rules.h"

namespace kitbag {

void WrongStringHint::Reset() {
  dwell_ = 0;
  string_ = KB_TUNER_NO_STRING;
  direction_ = KB_WRONG_STRING_NONE;
}

void WrongStringHint::Update(const Heard& heard) {
  const double distance = heard.midi - heard.target_midi;
  if (std::fabs(distance) <= tuning_rules::kWrongStringMinSemis) {
    Reset();
    return;
  }
  if (heard.rms < tuning_rules::kWrongStringMinRms || heard.nearest_on_target) {
    dwell_ = 0;
    return;
  }
  const bool left_band = std::fabs(heard.midi - band_midi_) >
                         tuning_rules::kWrongStringStableSemis;
  if (dwell_ == 0 || left_band) {
    band_midi_ = heard.midi;
    dwell_ = 0;
  }
  if (++dwell_ < dwell_hops_) return;
  string_ = heard.nearest;
  direction_ = distance < 0.0 ? KB_WRONG_STRING_BELOW : KB_WRONG_STRING_ABOVE;
}

}  // namespace kitbag
