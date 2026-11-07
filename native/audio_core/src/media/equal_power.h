#ifndef KITBAG_MEDIA_EQUAL_POWER_H
#define KITBAG_MEDIA_EQUAL_POWER_H

#include <cmath>
#include <cstdint>
#include <numbers>

namespace kitbag {

struct FadeGains {
  float out;
  float in;
};

// Frame i of a sine/cosine crossfade lasting `frames`, sampled mid-frame.
inline FadeGains EqualPowerAt(int64_t i, int64_t frames) {
  constexpr double kQuarterTurn = std::numbers::pi / 2.0;
  const double angle = (static_cast<double>(i) + 0.5) * kQuarterTurn /
                       static_cast<double>(frames);
  return {
      static_cast<float>(std::cos(angle)),
      static_cast<float>(std::sin(angle))
  };
}

}  // namespace kitbag

#endif  // KITBAG_MEDIA_EQUAL_POWER_H
