#ifndef KITBAG_METRONOME_METRONOME_TYPES_H
#define KITBAG_METRONOME_METRONOME_TYPES_H

#include <cstdint>
#include <vector>

namespace kitbag {

enum class Accent : uint8_t { kMuted = 0, kNormal = 1, kAccented = 2 };

struct BeatGrid {
  std::vector<double> beat_times_sec;
  // Song second t falls on engine frame anchor_frame + t * sample_rate.
  uint64_t anchor_frame = 0;
};

}  // namespace kitbag

#endif  // KITBAG_METRONOME_METRONOME_TYPES_H
