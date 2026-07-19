#ifndef KITBAG_MIXER_H
#define KITBAG_MIXER_H

#include <atomic>
#include <cstdint>
#include <vector>

namespace kitbag {

/// Lock-free N-track audio mixer for stem playback. Gain, mute and solo are
/// atomic and safe to change while playing; SetTrackData is not.
class Mixer {
 public:
  static constexpr int kMaxTracks = 16;
  static constexpr float kMinGain = 0.0f;
  static constexpr float kMaxGain = 2.0f;

  Mixer() = default;
  ~Mixer() = default;
  Mixer(const Mixer&) = delete;
  Mixer& operator=(const Mixer&) = delete;

  /// Load PCM into a track; mono or stereo interleaved float. NOT RT-safe — it
  /// reallocates, so never call it while the callback runs (SPEC.md §4.1).
  void SetTrackData(
      int track,
      const float* pcm,
      uint64_t num_frames,
      uint32_t channels,
      uint32_t sample_rate
  );

  void SetGain(int track, float gain);
  void SetMute(int track, bool muted);
  /// While any track is soloed, only soloed tracks reach the output.
  void SetSolo(int track, bool soloed);

  float Gain(int track) const;
  bool Muted(int track) const;
  bool Soloed(int track) const;

  /// Start/stop playback.
  void Play();
  void Stop();
  bool is_playing() const {
    return playing_.load();
  }

  /// Seek to a frame position (measured at the track's sample rate).
  void Seek(uint64_t frame);
  uint64_t position() const {
    return read_frame_.load();
  }

  /// Mixes active tracks into [output] — interleaved stereo float,
  /// [frame_count] frames at [sr]. RT-safe unless a track is being modified.
  void Process(float* output, uint32_t frame_count, uint32_t sr);

  int active_track_count() const {
    return track_count_;
  }
  uint64_t track_frames(int track) const;

 private:
  struct Track {
    std::vector<float> pcm;
    uint32_t channels = 0;
    uint32_t sample_rate = 0;
    uint64_t num_frames = 0;
    std::atomic<float> gain{1.0f};
    std::atomic<bool> mute{false};
    std::atomic<bool> solo{false};
    bool has_data = false;
  };

  static void MixMono(
      const Track& tr,
      float* output,
      uint64_t start_frame,
      uint64_t frames,
      float gain
  );
  static void MixStereo(
      const Track& tr,
      float* output,
      uint64_t start_frame,
      uint64_t frames,
      float gain
  );
  static uint64_t MixTrack(
      const Track& tr,
      float* output,
      uint32_t frame_count,
      uint64_t start_frame,
      bool any_solo,
      uint32_t sr
  );

  Track tracks_[kMaxTracks];
  int track_count_ = 0;
  std::atomic<uint64_t> read_frame_{0};
  std::atomic<bool> playing_{false};
  // Recalculated after each solo change; relaxed ordering is fine since
  // the audio thread will pick it up on the next callback.
  std::atomic<bool> any_solo_{false};
};

}  // namespace kitbag

#endif  // KITBAG_MIXER_H
