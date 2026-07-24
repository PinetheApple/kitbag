#ifndef KITBAG_MIXER_MIXER_H
#define KITBAG_MIXER_MIXER_H

#include <atomic>
#include <cstdint>
#include <memory>
#include <vector>

#include "media/streaming_track.h"
#include "rt/spsc_ring.h"

namespace kitbag {

/// Lock-free N-track audio mixer for stem playback (SPEC.md §4.1). Each track is
/// a StreamingTrack the callback drains, so mixer memory is O(tracks), not
/// O(duration). Two concurrency disciplines cross the app→RT seam, only two
/// (design-audit F3): a track's playable state is built off-thread and swapped
/// in by RtPublisher (inside StreamingTrack); scalar control — gain, mute, solo,
/// the whole transport — crosses the command ring and is applied by the callback.
class Mixer {
 public:
  static constexpr int kMaxTracks = 16;
  static constexpr float kMinGain = 0.0f;
  static constexpr float kMaxGain = 2.0f;

  /// [engine_rate] is the device/output sample rate each track is resampled to
  /// on load, so Process never sees a rate mismatch (SPEC.md §4.1). scratch_ is
  /// sized once here for the widest supported track.
  explicit Mixer(uint32_t engine_rate);
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

  /// Non-blocking: true once a source is live (published) for a track.
  bool track_ready(int track) const;

  /// Stream a track from a caller-owned reader that must outlive the track.
  /// Same publish discipline as LoadTrack.
  bool SetTrackSource(
      int track,
      SourceReader* reader,
      uint64_t now_frame,
      bool engine_running
  );

  /// Gain, mute and solo cross the command ring and are applied at the top of the
  /// next block; the getters read the callback-published mirror.
  void SetGain(int track, float gain);
  void SetMute(int track, bool muted);
  /// While any track is soloed, only soloed tracks reach the output.
  void SetSolo(int track, bool soloed);

  float gain(int track) const;
  bool muted(int track) const;
  bool soloed(int track) const;

  /// Transport commands. The off-thread read-ahead work runs here on the app
  /// thread; the transport counter and playing flag cross the command ring so the
  /// callback is their sole writer and a rewind can never be overwritten.
  void Play();
  /// Stops playback and rewinds the head to 0 (SPEC.md §4.4). With the device
  /// live it rewinds each source by rebuild-and-swap, never an in-place ring
  /// Clear (#25) — the invariant lives in StreamingTrack::RewindForStop.
  void Stop(uint64_t now_frame, bool engine_running);
  /// Ends playback holding the head, so a following Play resumes there.
  void Pause();
  /// Seek to a frame position (measured at engine rate); the counter update is
  /// applied by the callback next block. Each track routes through
  /// StreamingTrack, which rebuilds and swaps a fresh source off the callback
  /// when the device is live rather than racing a ring Clear (#25).
  void Seek(uint64_t frame, uint64_t now_frame, bool engine_running);

  /// Callback-published mirror. Reflects the state the callback drained, so it
  /// converges within one block once the device is running.
  bool is_playing() const {
    return playing_.load(std::memory_order_relaxed);
  }
  uint64_t position() const {
    return read_frame_.load(std::memory_order_relaxed);
  }

  /// Mixes active tracks into [output] — interleaved stereo float, [frame_count]
  /// frames at engine rate. RT-safe: drains the command ring, acquire-loads each
  /// published source, mixes into pre-sized scratch. Allocates nothing, takes no
  /// lock, frees nothing.
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
  /// the published node (acquire load) only, so the render thread may poll it.
  /// Exists so a concurrent test can observe a ring the callback drains (#25).
  uint64_t rt_track_buffered(int track) const;
  /// True once a track's source has delivered its last frame, or it has no
  /// source at all.
  bool track_at_end(int track) const;

  /// App thread, callback quiescent. Frees every source retired but not yet
  /// reclaimed; Engine::Stop calls it, mirroring Metronome::ReleaseRetiredGrids.
  void ReleaseRetiredSources();

 private:
  /// App-thread-facing per-track handle. `stream` owns the streaming transport
  /// and the two app→RT disciplines; the gain/mute/solo mirrors are written only
  /// by the callback drain. `stream` is heap-held so the array is default-
  /// constructible while StreamingTrack takes the engine rate at construction.
  struct Track {
    std::unique_ptr<StreamingTrack> stream;
    std::atomic<float> gain{1.0f};
    std::atomic<bool> mute{false};
    std::atomic<bool> solo{false};
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

  static constexpr size_t kCommandRingSize = 64;

  // App thread. Raises the high-water iteration bound to cover a freshly loaded
  // track; unload never lowers it (see active_track_count).
  void NoteTrackLoaded(int track);
  // App thread. Rescans the loaded tracks' lengths and republishes the longest
  // (B5): raising it on load and lowering it on unload/reload-to-shorter, so the
  // transport auto-stop always follows the current longest track, not a stale max.
  void RecomputeLongestFrames();

  // App thread. Hands a command to the callback, dropping it if the ring is full
  // rather than blocking — the realtime choice, matching the metronome. Drops are
  // counted for diagnostics, never fatal.
  void Enqueue(const Command& command);

  // Command drain, run at the top of Process. ApplyCommand holds the only
  // exhaustive switch over CommandType, so a new command is a -Wswitch error
  // rather than a silent drop.
  void ApplyPendingCommands();
  void ApplyCommand(const Command& command);
  void RecomputeAnySolo();

  void MixTrack(Track& tr, float* output, uint32_t frame_count, bool any_solo);
  void MixAllTracks(float* output, uint32_t frame_count, bool any_solo);
  void AdvanceTransport(uint64_t start_frame, uint32_t frame_count);

  Track tracks_[kMaxTracks];
  // Written by the load path, read every block by the callback (track_count_ in
  // RecomputeAnySolo/MixAllTracks, longest_frames_ in AdvanceTransport). A load
  // overlaps the callback during playback, so these are atomic (relaxed): on
  // armv7 a plain uint64_t longest_frames_ could tear (#23). Relaxed is enough —
  // no ordering rides on them: the source itself crosses via the publisher's
  // release/acquire, and the callback tolerates track_count_ momentarily ahead of
  // the published set (MixTrack drains nothing for a not-yet-published track).
  std::atomic<int> track_count_{0};
  std::atomic<uint64_t> longest_frames_{0};
  // Drain target, sized once at construction to kMaxBlockFrames * kMaxChannels
  // and never reallocated.
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
