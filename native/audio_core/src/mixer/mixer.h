#ifndef KITBAG_MIXER_MIXER_H
#define KITBAG_MIXER_MIXER_H

#include <atomic>
#include <cstdint>
#include <memory>
#include <vector>

#include "media/audio_source.h"
#include "rt/rt_publisher.h"
#include "rt/spsc_ring.h"

namespace kitbag {

/// Lock-free N-track audio mixer for stem playback (SPEC.md §4.1). Each track is
/// an AudioSource the callback drains, so mixer memory is O(tracks), not
/// O(duration). Two concurrency disciplines cross the app→RT seam, and only two
/// (design-audit F3): a track's playable state is built off-thread and swapped
/// in by RtPublisher; every scalar control — gain, mute, solo, and the whole
/// transport — crosses through the command ring and is applied by the callback.
class Mixer {
 public:
  static constexpr int kMaxTracks = 16;
  static constexpr float kMinGain = 0.0f;
  static constexpr float kMaxGain = 2.0f;
  /// Largest block the drain services; scratch is sized to it at construction so
  /// Process never allocates.
  static constexpr uint32_t kMaxBlockFrames = 4096;
  /// Stem playback is mono or stereo. scratch_ is sized to this at construction
  /// and never reallocated, so a wider track loaded during playback cannot free
  /// the buffer under a concurrent callback read; such tracks are rejected at
  /// load instead (BuildTrackSource).
  static constexpr uint32_t kMaxChannels = 2;

  /// [engine_rate] is the device/output sample rate every track is resampled to
  /// on load, so Process never sees a rate mismatch (SPEC.md §4.1). scratch_ is
  /// sized once here for the widest supported track.
  explicit Mixer(uint32_t engine_rate)
      : engine_rate_(engine_rate),
        scratch_(static_cast<size_t>(kMaxBlockFrames) * kMaxChannels, 0.0f) {}
  /// Each track's RtPublisher dtor deletes its live source; the source dtor
  /// joins the read-ahead thread before its readers die (see TrackSource).
  ~Mixer() = default;
  Mixer(const Mixer&) = delete;
  Mixer& operator=(const Mixer&) = delete;

  /// Load PCM into a track; mono or stereo interleaved float. RT-safe: it builds
  /// the source off-thread and publishes it by atomic swap, so loading during
  /// playback cannot tear a read (SPEC.md §4.1). [now_frame] is the engine clock
  /// and [engine_running] true whenever the callback can run; together they date
  /// the retired source for deferred reclamation — the callback never frees.
  void SetTrackData(
      int track,
      const float* pcm,
      uint64_t num_frames,
      uint32_t channels,
      uint32_t sample_rate,
      uint64_t now_frame,
      bool engine_running
  );

  /// Stream a track from a caller-owned reader that must outlive the track.
  /// Same publish discipline as SetTrackData.
  bool SetTrackSource(
      int track,
      SourceReader* reader,
      uint64_t now_frame,
      bool engine_running
  );

  /// Gain, mute and solo cross through the command ring and are applied at the
  /// top of the next block; the getters read the callback-published mirror.
  void SetGain(int track, float gain);
  void SetMute(int track, bool muted);
  /// While any track is soloed, only soloed tracks reach the output.
  void SetSolo(int track, bool soloed);

  float gain(int track) const;
  bool muted(int track) const;
  bool soloed(int track) const;

  /// Transport commands. The source read-ahead work that must be off-thread
  /// (Start/Stop/Seek/Prime) runs here on the app thread; the transport counter
  /// and the playing flag cross through the command ring so the callback is
  /// their sole writer and a rewind can never be overwritten (SPEC.md §2.2).
  void Play();
  /// Ends playback and rewinds the head to frame 0 (SPEC.md §4.4).
  void Stop();
  /// Ends playback holding the head, so a following Play resumes there.
  void Pause();
  /// Seek to a frame position (measured at the engine rate). The counter update
  /// is applied by the callback at the next block; the source reposition is done
  /// here. See the note on live-playback seek quiescence in mixer.cpp.
  void Seek(uint64_t frame);

  /// Callback-published mirror. Reflects state the callback has drained, so it
  /// converges within one block once the device is running.
  bool is_playing() const {
    return playing_.load(std::memory_order_relaxed);
  }
  uint64_t position() const {
    return read_frame_.load(std::memory_order_relaxed);
  }

  /// Mixes active tracks into [output] — interleaved stereo float, [frame_count]
  /// frames at the engine rate. RT-safe: drains the command ring, acquire-loads
  /// each published source, and mixes into pre-sized scratch. Allocates nothing,
  /// takes no lock, frees nothing.
  void Process(float* output, uint32_t frame_count);

  int active_track_count() const {
    return track_count_;
  }
  /// Commands dropped because the ring was full since construction. A diagnostic;
  /// a healthy caller never overflows a 64-deep ring between blocks.
  uint64_t dropped_commands() const {
    return dropped_commands_;
  }
  uint64_t track_frames(int track) const;
  /// Frames buffered ahead in a track's source. A readiness probe for priming;
  /// never called from the audio callback.
  uint64_t track_buffered(int track) const;
  /// True once a track's source has delivered its last frame, or it has no
  /// source at all.
  bool track_at_end(int track) const;

  /// App thread, callback quiescent. Frees every source retired but not yet
  /// reclaimed; Engine::Stop calls it, mirroring Metronome::ReleaseRetiredGrids.
  void ReleaseRetiredSources();

 private:
  /// The published, playable state of one track. `source` is declared LAST so
  /// its dtor — which joins the read-ahead thread — runs before the readers it
  /// points into are destroyed. Declaring it first (as A2 did) was a teardown
  /// use-after-free: the read-ahead thread outlived the readers it read from.
  struct TrackSource {
    uint32_t channels = 0;
    uint64_t num_frames = 0;
    std::unique_ptr<SourceReader> owned_reader;
    std::unique_ptr<SourceReader> resampler;
    std::unique_ptr<AudioSource> source;
  };

  enum class CommandType : uint8_t {
    kSetGain,
    kSetMute,
    kSetSolo,
    kPlay,
    kStop,
    kPause,
    kSeek,
  };

  struct Command {
    CommandType type;
    int32_t track = 0;
    float fvalue = 0.0f;
    uint64_t frame = 0;  // engine-clock target for kSeek
  };

  /// App-thread-facing per-track handle. `published` owns the live source;
  /// `live_source` is a non-owning pointer to it so the transport methods can do
  /// the off-thread read-ahead work without reaching through the RT acquire
  /// load. The gain/mute/solo mirrors are written only by the callback drain.
  struct Track {
    RtPublisher<TrackSource> published;
    AudioSource* live_source = nullptr;  // app thread; == the published source
    uint64_t live_num_frames = 0;        // app thread
    std::atomic<float> gain{1.0f};
    std::atomic<bool> mute{false};
    std::atomic<bool> solo{false};
  };

  static constexpr size_t kCommandRingSize = 64;

  bool BuildTrackSource(TrackSource& ts, SourceReader* base);
  void PublishTrack(
      int track,
      std::unique_ptr<TrackSource> ts,
      uint64_t now_frame,
      bool engine_running
  );
  // Blocks off the audio thread until the source has read enough ahead for the
  // callback to drain full blocks; bounded by a timeout.
  void Prime(AudioSource& src, uint64_t num_frames);

  // App thread. Hands a command to the callback, dropping it if the ring is full
  // (> kCommandRingSize unconsumed) rather than blocking — the realtime choice,
  // matching the metronome. A dropped control (a lost seek or gain) beats
  // stalling the app thread; drops are counted for diagnostics, never fatal.
  void Enqueue(const Command& command);

  // Command drain, run at the top of Process. ApplyCommand holds the only
  // exhaustive switch over CommandType, so a new command is a -Wswitch error
  // rather than a silent drop.
  void ApplyPendingCommands();
  void ApplyCommand(const Command& command);
  void RecomputeAnySolo();

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
      const TrackSource* src,
      float* output,
      uint32_t frame_count,
      bool any_solo
  );
  void MixAllTracks(float* output, uint32_t frame_count, bool any_solo);
  void AdvanceTransport(uint64_t start_frame, uint32_t frame_count);

  Track tracks_[kMaxTracks];
  // track_count_ and longest_frames_ are plain scalars the load path writes and
  // the callback reads — RecomputeAnySolo reads track_count_ before the playing_
  // guard, auto-stop (AdvanceTransport) reads longest_frames_ after it.
  // Publishing through SetTrackData carries engine_running, so a load DOES
  // overlap the callback during playback — these two are outside the publish/ring
  // disciplines. A torn read of an aligned integer during that overlap is benign
  // (real on armv7/32-bit), and making it safe is deferred to #23 (likely landed
  // alongside B5/A4), which notes the fix needs publish-vs-count ordering care.
  // This is not a no-overlap guarantee.
  int track_count_ = 0;
  // The output/device rate every track is resampled to on load.
  uint32_t engine_rate_;
  uint64_t longest_frames_ = 0;
  // Drain target, sized once at construction to kMaxBlockFrames * kMaxChannels
  // and never reallocated (see the ctor and kMaxChannels).
  std::vector<float> scratch_;
  // Written only by the callback (command drain + block advance); the getters
  // read it. Single writer, so the Stop/Seek rewind can never be overwritten.
  std::atomic<uint64_t> read_frame_{0};
  std::atomic<bool> playing_{false};
  std::atomic<bool> any_solo_{false};
  SpscRing<Command, kCommandRingSize> commands_;
  // App thread only. Counts commands dropped because the ring was full; a
  // diagnostic, since a full ring drops rather than blocks (see Enqueue).
  uint64_t dropped_commands_ = 0;
};

}  // namespace kitbag

#endif  // KITBAG_MIXER_MIXER_H
