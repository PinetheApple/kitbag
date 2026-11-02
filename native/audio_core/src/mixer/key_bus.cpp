#include "mixer/key_bus.h"

#include "media/streaming_track.h"

namespace kitbag {

void KeyBus::Configure(
    float sample_rate,
    int semitones,
    const KeyBusConfig& config
) {
  generation = config.generation;
  if (config.vendor_default) {
    stretch.ConfigureVendorDefault(kChannels, sample_rate);
  } else {
    stretch.Configure(kChannels, sample_rate);
  }
  stretch.SetTransposeSemitones(static_cast<float>(semitones));
  const size_t block =
      static_cast<size_t>(StreamingTrack::kMaxBlockFrames) * kChannels;
  input.assign(block, 0.0f);
  output.assign(block, 0.0f);
  const int seek = stretch.SeekFrames();
  preroll.assign(static_cast<size_t>(seek) * kChannels, 0.0f);
  drain_frames = 2LL * seek;
}

}  // namespace kitbag
