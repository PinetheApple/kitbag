#ifndef KITBAG_MIXER_MIXER_TRACK_H
#define KITBAG_MIXER_MIXER_TRACK_H

#include <atomic>
#include <cstdint>
#include <memory>

#include "media/streaming_track.h"

namespace kitbag {

// The mirrors are written only by the callback drain. `stream` is heap-held
// so the array is default-constructible.
struct MixerTrack {
  std::unique_ptr<StreamingTrack> stream;
  std::atomic<float> gain{1.0f};
  std::atomic<bool> mute{false};
  std::atomic<bool> solo{false};
  std::atomic<int> pitch{0};
  // Callback only: a key change fades the stem from this bus to its new one.
  int fade_from = 0;
  int64_t fade_left = 0;
};

}  // namespace kitbag

#endif  // KITBAG_MIXER_MIXER_TRACK_H
