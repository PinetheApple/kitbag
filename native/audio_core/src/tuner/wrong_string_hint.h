#ifndef KITBAG_TUNER_WRONG_STRING_HINT_H
#define KITBAG_TUNER_WRONG_STRING_HINT_H

// Manual mode's "are you tuning the correct string?" hint (spec P20-P23): a
// loud, stable pitch far from the selected string, sustained past a dwell.
#include "kitbag_api.h"

#include <cstdint>

namespace kitbag {

class WrongStringHint {
 public:
  struct Heard {
    double midi;             // the measured pitch
    double rms;              // the frame's level
    double target_midi;      // the selected string
    int32_t nearest;         // string nearest the pitch
    bool nearest_on_target;  // nearest has the target's pitch (P24 pairs)
  };

  void Init(int dwell_hops) {
    dwell_hops_ = dwell_hops;
    Reset();
  }
  void Reset();
  // One analysis hop with a pitch; a hop without one keeps the hint standing.
  void Update(const Heard& heard);
  void Interrupt() {
    dwell_ = 0;
  }

  int32_t string() const {
    return string_;
  }
  int32_t direction() const {
    return direction_;
  }

 private:
  int dwell_hops_ = 0;
  int dwell_ = 0;
  double band_midi_ = 0.0;
  int32_t string_ = KB_TUNER_NO_STRING;
  int32_t direction_ = KB_WRONG_STRING_NONE;
};

}  // namespace kitbag

#endif  // KITBAG_TUNER_WRONG_STRING_HINT_H
