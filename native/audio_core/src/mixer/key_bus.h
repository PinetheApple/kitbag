#ifndef KITBAG_MIXER_KEY_BUS_H
#define KITBAG_MIXER_KEY_BUS_H

#include <cstdint>
#include <memory>
#include <vector>

#include "stretch/time_stretch.h"

namespace kitbag {

// Configure allocates on the app thread; after publish only the callback
// touches it.
struct KeyBus {
  static constexpr int kChannels = 2;

  void Configure(float sample_rate, int semitones, bool vendor_default);

  TimeStretch stretch;
  std::vector<float> input;
  std::vector<float> output;
  std::vector<float> preroll;
  int64_t drain_frames = 0;
  int64_t idle_frames = 0;
  bool dormant = true;
  bool vendor_default = false;
};

struct KeyBusSlot {
  std::unique_ptr<KeyBus> bus;
};

}  // namespace kitbag

#endif  // KITBAG_MIXER_KEY_BUS_H
