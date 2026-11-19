#include "mixer/mixer.h"

namespace kitbag {

MixSnapshot Mixer::Snapshot() const {
  MixSnapshot snapshot{
      .master_gain = app_mix_.master_gain,
      .rate = app_mix_.rate,
      .longest_frames = longest_frames_.load(std::memory_order_relaxed)
  };
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int t = 0; t < count; ++t) {
    const StreamingTrack& stream = *tracks_[t].stream;
    if (!stream.ready()) continue;
    snapshot.tracks.push_back(
        {.path = stream.load_path(),
         .gain = app_mix_.gain[t],
         .mute = app_mix_.mute[t],
         .solo = app_mix_.solo[t],
         .pitch = app_mix_.pitch[t]}
    );
  }
  return snapshot;
}

bool Mixer::track_input_done(int track) const {
  if (track < 0 || track >= track_count_.load(std::memory_order_relaxed)) {
    return true;
  }
  return tracks_[track].stream->input_done();
}

}  // namespace kitbag
