#ifndef KITBAG_MIXER_MIXER_H
#define KITBAG_MIXER_MIXER_H

#include <atomic>
#include <cstdint>
#include <memory>
#include <vector>

#include "media/loop_layout.h"
#include "media/streaming_track.h"
#include "rt/rt_publisher.h"
#include "rt/spsc_ring.h"

namespace kitbag {

/// Lock-free stem mixer (SPEC.md §4.1). Sources and transport plans are built
/// off-thread and swapped in by RtPublisher; scalars cross the command ring.
class Mixer {
 public:
  static constexpr int kMaxTracks = 16;
  static constexpr float kMinGain = 0.0f;
  static constexpr float kMaxGain = 2.0f;
  static constexpr double kLoopCrossfadeSeconds = 0.005;
  static constexpr int64_t kMinLoopCrossfades = 2;

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

  /// See StreamingTrack::ReserveCallbackFrames; applies to every track.
  void ReserveCallbackFrames(uint32_t frames);

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

  void SetMasterGain(float gain);
  float master_gain() const {
    return master_gain_.load(std::memory_order_relaxed);
  }

  /// Transport. The read-ahead work runs here on the app thread; the callback
  /// is the sole writer of the head and the playing flag.
  void Play();
  /// Stops playback and rewinds the head to 0 (SPEC.md §4.4).
  void Stop(uint64_t now_frame, bool engine_running);
  /// Ends playback holding the head, so a following Play resumes there.
  void Pause();
  /// Like Stop's rewind and the loop calls, rebuilds every source rather than
  /// Clear a ring the callback may read (#25). Clamps to the longest track.
  void Seek(uint64_t frame, uint64_t now_frame, bool engine_running);

  enum class LoopResult : uint8_t { kOk, kInvalid, kRebuildFailed };
  LoopResult
  SetLoop(int64_t start, int64_t end, uint64_t now_frame, bool engine_running);
  bool ClearLoop(uint64_t now_frame, bool engine_running);
  int64_t crossfade_frames() const {
    return crossfade_frames_;
  }

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
  /// Realtime, on the Process thread: the transport of the last block mixed.
  const SongClock& song_clock() const {
    return song_clock_;
  }

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
  /// reclaimed.
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
    kSetMasterGain,
  };

  struct Command {
    CommandType type;
    int32_t track = 0;
    float fvalue = 0.0f;
  };

  // Published, never queued: a dropped plan would strand every track on an
  // epoch the callback never adopts.
  enum class PlanKind : uint8_t { kJump, kKeep };
  struct TransportPlan {
    PlanKind kind = PlanKind::kJump;
    int64_t frame = 0;
    // A keep's transport frame when its head stood at `frame`.
    int64_t base = 0;
    LoopLayout layout;
    uint64_t epoch = 0;
  };

  static constexpr size_t kCommandRingSize = 64;

  // App thread. Unload never lowers the iteration bound (see active_track_count).
  void NoteTrackLoaded(int track);
  SourceStamp JoinStamp() const;
  // App thread. Rescans the loaded tracks' lengths and republishes the longest
  // (B5): raising it on load and lowering it on unload/reload-to-shorter, so the
  // transport auto-stop always follows the current longest track, not a stale max.
  void RecomputeLongestFrames();

  // App thread. Hands a command to the callback, dropping it if the ring is full
  // rather than blocking — the realtime choice, matching the metronome. Drops are
  // counted for diagnostics, never fatal.
  void Enqueue(const Command& command);
  // App thread. Rebuilds every track at the plan's frame, all or nothing, then
  // publishes the plan the callback adopts them by.
  bool Relayout(TransportPlan plan, uint64_t now_frame, bool engine_running);
  bool StageAll(int64_t frame, const SourceStamp& stamp, bool engine_running);
  int64_t SeekTarget(int64_t frame) const;
  struct Head {
    int64_t stream;
    int64_t transport;
    bool jump_pending;
  };
  // App thread. The head in the latest plan's stream frames, from the transport
  // clock alone so no two mirrors written in different blocks get paired.
  Head PlannedHead() const;

  // Command drain, run at the top of Process. ApplyCommand holds the only
  // exhaustive switch over CommandType, so a new command is a -Wswitch error
  // rather than a silent drop.
  void ApplyPendingCommands();
  void ApplyCommand(const Command& command);
  void RecomputeAnySolo();
  void AdoptPlan();
  bool TransportFrameFor(const StreamingTrack::RtView& view, int64_t* frame);
  bool AlignTo(AudioSource& source, int64_t frame);

  void MixTrack(Track& tr, float* output, uint32_t frame_count, bool any_solo);
  void MixAllTracks(float* output, uint32_t frame_count, bool any_solo);
  void AdvanceTransport(uint32_t frame_count);

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
  std::atomic<float> master_gain_{1.0f};
  // Callback-owned transport. stream_frame_ is what every adopted source is
  // aligned to; layout_ maps it to the song frame read_frame_ mirrors.
  int64_t stream_frame_ = 0;
  LoopLayout layout_;
  uint64_t epoch_ = 0;
  std::atomic<uint64_t> plan_generation_{0};
  // Frames played since construction; unlike stream_frame_ it never jumps.
  std::atomic<int64_t> transport_frame_{0};
  std::atomic<int64_t> jump_base_{0};
  SongClock song_clock_;
  RtPublisher<TransportPlan> plans_;
  // App thread: the stamp the next build carries.
  uint64_t app_epoch_ = 0;
  LoopLayout app_layout_;
  bool app_playing_ = false;
  int64_t crossfade_frames_;
  SpscRing<Command, kCommandRingSize> commands_;
  // App thread only. Counts commands dropped because the ring was full; a
  // diagnostic, since a full ring drops rather than blocks (see Enqueue).
  uint64_t dropped_commands_ = 0;
};

}  // namespace kitbag

#endif  // KITBAG_MIXER_MIXER_H
