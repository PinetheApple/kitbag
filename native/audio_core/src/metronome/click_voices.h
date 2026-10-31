#ifndef KITBAG_METRONOME_CLICK_VOICES_H
#define KITBAG_METRONOME_CLICK_VOICES_H

#include <cstdint>

namespace kitbag {

class ClickVoices {
 public:
  void Trigger(
      double frequency_hz,
      double amplitude,
      double decay_per_second,
      uint32_t sample_rate
  );
  float Render();

 private:
  struct Voice {
    bool active = false;
    double phase = 0.0;
    double phase_step = 0.0;
    double amplitude = 0.0;
    double decay_per_sample = 0.0;
  };

  static constexpr int kMaxVoices = 8;

  Voice* FreeOrQuietest();

  Voice voices_[kMaxVoices];
};

}  // namespace kitbag

#endif  // KITBAG_METRONOME_CLICK_VOICES_H
