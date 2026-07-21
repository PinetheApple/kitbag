#ifndef KITBAG_MIXER_MIXER_H
#define KITBAG_MIXER_MIXER_H

#include <atomic>
#include <cstdint>
#include <memory>
#include <vector>

#include "media/audio_source.h"

namespace kitbag {

/// Lock-free N-track audio mixer for stem playback. Each track is an
/// AudioSource the callback drains, so mixer memory is O(tracks), not
/// O(duration) (SPEC.md §4.1). Gain, mute and solo are atomic and safe to
/// change while playing; the setup and transport calls are not.
class Mixer {
 public:
  static constexpr int kMaxTracks = 16;
  static constexpr float kMinGain = 0.0f;
  static constexpr float kMaxGain = 2.0f;
  /// Largest block the drain services; scratch is sized to it at setup so
  /// Process never allocates.
  static constexpr uint32_t kMaxBlockFrames = 4096;

  Mixer() = default;
  ~Mixer() = default;
  Mixer(const Mixer&) = delete;
  Mixer& operator=(const Mixer&) = delete;

  /// Load PCM into a track; mono or stereo interleaved float. NOT RT-safe — it
  /// opens a source and copies, so never call it while the callback runs. The
  /// copy is legacy: see PcmSourceReader.
  void SetTrackData(
      int track,
      const float* pcm,
      uint64_t num_frames,
      uint32_t channels,
      uint32_t sample_rate
  );

  /// Stream a track from a caller-owned reader that must outlive the track.
  /// NOT RT-safe: opens the source. The RT-safe load/publish path is A3/A4.
  bool SetTrackSource(int track, SourceReader* reader);

  void SetGain(int track, float gain);
  void SetMute(int track, bool muted);
  /// While any track is soloed, only soloed tracks reach the output.
  void SetSolo(int track, bool soloed);

  float gain(int track) const;
  bool muted(int track) const;
  bool soloed(int track) const;

  /// Starts the read-ahead threads. NOT RT-safe; call off the audio thread.
  void Play();
  /// Ends playback and rewinds the head to frame 0 (SPEC.md §4.4).
  void Stop();
  /// Ends playback holding the head, so a following Play resumes there.
  void Pause();
  bool is_playing() const {
    return playing_.load();
  }

  /// Seek to a frame position (measured at the track's sample rate). NOT
  /// RT-safe: it stops and restarts the sources, so the callback must be
  /// quiescent across it (A3/A4 formalises the RT-safe path).
  void Seek(uint64_t frame);
  uint64_t position() const {
    return read_frame_.load();
  }

  /// Mixes active tracks into [output] — interleaved stereo float,
  /// [frame_count] frames at [sr]. RT-safe: it only drains already-prepared
  /// sources into pre-sized scratch.
  void Process(float* output, uint32_t frame_count, uint32_t sr);

  int active_track_count() const {
    return track_count_;
  }
  uint64_t track_frames(int track) const;
  /// Frames buffered ahead in a track's source. A readiness probe for priming;
  /// never called from the audio callback.
  uint64_t track_buffered(int track) const;
  /// True once a track's source has delivered its last frame, or it has no
  /// source at all.
  bool track_at_end(int track) const;

 private:
  struct Track {
    AudioSource source;
    // Set only by SetTrackData; the streaming setup path leaves it null and the
    // caller owns the reader.
    std::unique_ptr<SourceReader> owned_reader;
    uint32_t channels = 0;
    uint32_t sample_rate = 0;
    uint64_t num_frames = 0;
    std::atomic<float> gain{1.0f};
    std::atomic<bool> mute{false};
    std::atomic<bool> solo{false};
    bool has_data = false;
  };

  bool ConfigureTrack(
      Track& t,
      SourceReader* reader,
      int track,
      uint64_t num_frames
  );
  void EnsureScratch(uint32_t channels);
  // Blocks off the audio thread until the track's source has read enough ahead
  // for the callback to drain full blocks; bounded by a timeout.
  void Prime(Track& t);

  static void
  MixMono(const float* src, float* output, uint32_t frames, float gain);
  static void MixStereo(
      const float* src,
      uint32_t channels,
      float* output,
      uint32_t frames,
      float gain
  );
  void MixTrack(
      Track& tr,
      float* output,
      uint32_t frame_count,
      bool any_solo,
      uint32_t sr
  );

  Track tracks_[kMaxTracks];
  int track_count_ = 0;
  // Drives auto-stop. Plain, like track_count_: the setup path is its only
  // writer and never overlaps the callback.
  uint64_t longest_frames_ = 0;
  // Drain target, sized at setup to kMaxBlockFrames * widest channel count.
  std::vector<float> scratch_;
  uint32_t scratch_channels_ = 0;
  std::atomic<uint64_t> read_frame_{0};
  std::atomic<bool> playing_{false};
  // Recalculated after each solo change; relaxed ordering is fine since
  // the audio thread will pick it up on the next callback.
  std::atomic<bool> any_solo_{false};
};

}  // namespace kitbag

#endif  // KITBAG_MIXER_MIXER_H
