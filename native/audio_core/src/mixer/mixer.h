#ifndef KITBAG_MIXER_MIXER_H
#define KITBAG_MIXER_MIXER_H

#include <atomic>
#include <cstdint>
#include <memory>
#include <string>
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

  /// Load a track from a file path, streamed from disk. RT-safe: it opens,
  /// resamples and builds the source off the callback, then publishes it by
  /// atomic swap, so loading during playback cannot tear a read (SPEC.md §4.1).
  /// [now_frame] is the engine clock and [engine_running] true whenever the
  /// callback can run; together they date the retired source for deferred
  /// reclamation — the callback never frees. Returns false for a null path, a
  /// track outside [0, kMaxTracks), or a file that will not open.
  bool LoadTrack(
      int track,
      const char* path,
      uint64_t now_frame,
      bool engine_running
  );

  /// Retire a track's source: publishes an empty node so the callback drains
  /// nothing, and the old source is reclaimed off the callback. Recomputes the
  /// transport length (B5) so a shorter remaining track ends playback in time.
  void UnloadTrack(int track, uint64_t now_frame, bool engine_running);

  /// Non-blocking: true once a source is live (published) for the track.
  bool track_ready(int track) const;

  /// Stream a track from a caller-owned reader that must outlive the track.
  /// Same publish discipline as LoadTrack.
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
  /// Ends playback and rewinds the head to frame 0 (SPEC.md §4.4). Takes the same
  /// [now_frame]/[engine_running] as Seek: with the device live it rewinds each
  /// source by rebuild-and-swap, never an in-place ring Clear (#25).
  void Stop(uint64_t now_frame, bool engine_running);
  /// Ends playback holding the head, so a following Play resumes there.
  void Pause();
  /// Seek to a frame position (measured at the engine rate). The counter update
  /// is applied by the callback at the next block. A seek on a live (playing)
  /// track rebuilds a fresh source at the target off the callback and swaps it in
  /// by RtPublisher, so no ring Clear ever races the callback draining the old
  /// source (#25); [now_frame]/[engine_running] date the retired source exactly
  /// as LoadTrack does. In-place reposition runs only when the device is stopped
  /// AND the source thread is idle — the sole quiescent state; a running device
  /// or read-ahead thread rebuilds, since neither guarantees the callback has
  /// stopped draining this ring.
  void Seek(uint64_t frame, uint64_t now_frame, bool engine_running);

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

  /// High-water iteration bound (highest loaded track index + 1), not a live
  /// count of loaded tracks: unload does not lower it, since the callback loops
  /// must still cover a published track above an unloaded gap.
  int active_track_count() const {
    return track_count_.load(std::memory_order_relaxed);
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
  /// Realtime-safe sibling of track_buffered: reads the buffered count through
  /// the published node (acquire load) and the source ring's atomics only, never
  /// the app-thread live_source, so the render thread may poll it. Exists so a
  /// concurrent test can observe a ring the callback drains (#25).
  uint64_t rt_track_buffered(int track) const;
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
    // The reader identity, so a live seek can rebuild a fresh source. A file
    // track re-opens `load_path`; a SetTrackSource track re-wraps `ext_reader`.
    std::string load_path;               // app thread; set by LoadTrack
    SourceReader* ext_reader = nullptr;  // app thread; set by SetTrackSource
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
  // App thread. Rescans the loaded tracks' lengths and republishes the longest
  // (B5): raising it on load and lowering it on unload/reload-to-shorter, so the
  // transport auto-stop always follows the current longest track, not a stale max.
  void RecomputeLongestFrames();
  // Blocks off the audio thread until the source has read enough ahead for the
  // callback to drain full blocks; bounded by a timeout.
  void Prime(AudioSource& src, uint64_t num_frames);

  // App thread. Builds a fresh source at `target` from the track's reader
  // identity, started and primed; null if the rebuild fails. No Clear on a ring
  // the callback reads, so it is safe while the old source is still live (#25).
  std::unique_ptr<TrackSource> BuildReseekSource(int track, uint64_t target);
  // App thread. Stops the old source, then swaps in a BuildReseekSource node.
  // Returns false if the rebuild failed and the old source was resumed in place.
  bool ReseekLive(
      int track,
      uint64_t frame,
      uint64_t now_frame,
      bool engine_running
  );

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
  // Written by the load path, read every block by the callback (track_count_ in
  // RecomputeAnySolo/MixAllTracks, longest_frames_ in AdvanceTransport). A load
  // overlaps the callback during playback, so these are atomic (relaxed): on
  // armv7 a plain uint64_t longest_frames_ could tear (#23). Relaxed is enough —
  // no ordering rides on them: the source itself crosses via the publisher's
  // release/acquire, and the callback tolerates track_count_ momentarily ahead of
  // the published set (MixTrack and RecomputeAnySolo null-check the node, so a
  // not-yet-published track drains nothing).
  std::atomic<int> track_count_{0};
  // The output/device rate every track is resampled to on load.
  uint32_t engine_rate_;
  std::atomic<uint64_t> longest_frames_{0};
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
