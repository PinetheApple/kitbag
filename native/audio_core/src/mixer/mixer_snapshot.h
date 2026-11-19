#ifndef KITBAG_MIXER_MIXER_SNAPSHOT_H
#define KITBAG_MIXER_MIXER_SNAPSHOT_H

#include <array>
#include <cstdint>
#include <string>
#include <vector>

#include "media/audio_source.h"
#include "mixer/transport_plan.h"

namespace kitbag {

struct TrackSnapshot {
  std::string path;
  // Tests only: a caller-owned reader, used when path is empty.
  SourceReader* reader = nullptr;
  float gain = 1.0f;
  bool mute = false;
  bool solo = false;
  int pitch = 0;
};

// The mix as the app thread last set it, in track order; loaded tracks only.
struct MixSnapshot {
  std::vector<TrackSnapshot> tracks;
  float master_gain = 1.0f;
  float rate = kUnityRate;
  uint64_t longest_frames = 0;
};

// App thread: what the callback will hold once the command ring drains, so a
// snapshot never waits on a block the device may not render.
template <int kTracks>
struct MixerAppMix {
  std::array<float, kTracks> gain{};
  std::array<bool, kTracks> mute{};
  std::array<bool, kTracks> solo{};
  std::array<int, kTracks> pitch{};
  float master_gain = 1.0f;
  float rate = kUnityRate;

  MixerAppMix() {
    gain.fill(1.0f);
  }
};

}  // namespace kitbag

#endif  // KITBAG_MIXER_MIXER_SNAPSHOT_H
