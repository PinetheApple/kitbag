#ifndef KITBAG_MIXER_MIXER_H
#define KITBAG_MIXER_MIXER_H

#include <atomic>
#include <cstdint>
#include <memory>
#include <optional>
#include <vector>

#include "media/song_clock.h"
#include "media/streaming_track.h"
#include "mixer/key_bus.h"
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
  static constexpr float kUnityRate = 1.0f;
  static constexpr float kMinRate = 0.5f;
  static constexpr float kMaxRate = 1.0f;
  static constexpr int kMinPitchSemitones = -6;
  static constexpr int kMaxPitchSemitones = 6;

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

  /// Speed (SPEC.md §7.6), clamped to [kMinRate, kMaxRate]. Off unity the
  /// key buses engage: the app thread configures them here.
  void SetRate(float rate, uint64_t now_frame, bool engine_running);
  /// Absolute key of one stem in whole semitones, clamped to
  /// [kMinPitchSemitones, kMaxPitchSemitones]. Configures its bus if needed.
  void SetTrackPitch(
      int track,
      float semitones,
      uint64_t now_frame,
      bool engine_running
  );
  float rate() const {
    return rate_mirror_.load(std::memory_order_relaxed);
  }
  int track_pitch(int track) const;
  bool stretch_engaged() const {
    return engaged_.load(std::memory_order_relaxed);
  }
  /// Song frames read from the stems since construction, pre-roll included.
  int64_t fed_frames() const {
    return transport_frame_.load(std::memory_order_relaxed);
  }
  /// App thread only.
  int key_bus_count() const;
  /// Frames each track's read-ahead ring holds, stretch pre-roll included.
  uint64_t ring_frames() const;

  /// Callback-published mirror. Reflects the state the callback drained, so it
  /// converges within one block once the device is running.
  bool is_playing() const {
    return playing_.load(std::memory_order_relaxed);
  }
  uint64_t position() const {
    return read_frame_.load(std::memory_order_relaxed);
  }

  /// Interleaved stereo at engine rate. RT-safe: allocates nothing, takes no
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
  /// Commands dropped because the ring was full since construction.
  uint64_t dropped_commands() const {
    return dropped_commands_;
  }
  uint64_t track_frames(int track) const;
  /// Frames buffered ahead in a track's source. A readiness probe for priming;
  /// never called from the audio callback.
  uint64_t track_buffered(int track) const;
  /// Realtime-safe sibling of track_buffered, so a concurrent test can observe
  /// a ring the callback drains (#25).
  uint64_t rt_track_buffered(int track) const;
  /// True once a track's source has delivered its last frame, or has none.
  bool track_at_end(int track) const;

  /// App thread, callback quiescent. Frees every retired source now.
  void ReleaseRetiredSources();

 private:
  // The mirrors are written only by the callback drain. `stream` is heap-held
  // so the array is default-constructible.
  struct Track {
    std::unique_ptr<StreamingTrack> stream;
    std::atomic<float> gain{1.0f};
    std::atomic<bool> mute{false};
    std::atomic<bool> solo{false};
    std::atomic<int> pitch{0};
    // Callback only: a key change fades the stem from this bus to its new one.
    int fade_from = 0;
    int64_t fade_left = 0;
  };

  enum class CommandType : uint8_t {
    kSetGain,
    kSetMute,
    kSetSolo,
    kPlay,
    kStop,
    kPause,
    kSetMasterGain,
    kSetRate,
    kSetTrackPitch,
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
  static constexpr int kKeyBusCount =
      kMaxPitchSemitones - kMinPitchSemitones + 1;
  // A pending rate waits this long after the last record, which bounds how
  // many records the clock needs to cover the stretch's output latency.
  static constexpr int64_t kMinRecordSpacingFrames = 512;

  static float ClampRate(float rate);
  static int ClampPitch(float semitones);

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
  bool Enqueue(const Command& command);
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
  void ApplyStretchCommand(const Command& command);
  void RecomputeAnySolo();
  void AdoptPlan();
  bool
  TransportFrameFor(const StreamingTrack::RtView& view, int64_t* frame) const;
  bool AlignTo(AudioSource& source, int64_t frame);

  void MixTrack(Track& tr, float* output, uint32_t frame_count, bool any_solo);
  void MixAllTracks(float* output, uint32_t frame_count, bool any_solo);
  void AdvanceTransport(uint32_t frame_count);

  // App thread: key-bus lifecycle (mixer_keys.cpp).
  bool WantsStretch() const;
  void PublishBus(int slot, uint64_t now_frame, bool engine_running);
  bool MatchBusConfig(int live, uint64_t now_frame, bool engine_running);
  void EngageBuses(
      std::optional<int> extra,
      uint64_t now_frame,
      bool engine_running
  );
  void Reprime(uint64_t now_frame, bool engine_running);
  void PrepareBusFor(int track, uint64_t now_frame, bool engine_running);
  void MarkUsedBuses(bool* used) const;
  bool FreeUnusedBuses(uint64_t now_frame, bool engine_running);
  bool BusesAgree(const KeyBus& any) const;

  // Callback: the engaged path (mixer_stretch.cpp).
  KeyBus* BusAt(int slot) const;
  KeyBus* AnyBus() const;
  bool RtWantsStretch() const;
  void CountMembers(int* members) const;
  KeyBus* TrackBus(const Track& tr) const;
  float TrackGain(const Track& tr, bool any_solo) const;
  bool AlignedView(const Track& tr, StreamingTrack::RtView* view);
  bool RingsReady(int64_t frames) const;
  void ReadPreRoll(int64_t lag, bool any_solo);
  void ReadTrackPreRoll(
      const StreamingTrack::RtView& view,
      KeyBus* bus,
      int64_t lag,
      float gain
  );
  void SeekBuses(int64_t lag);
  bool PrimeIfReady(uint32_t frame_count, bool any_solo);
  void ResetRecords(const TimeStretch& stretch);
  void ApplyPendingRate();
  void PushRecord();
  void MoveToBus(Track& tr, int pitch);
  void FeedTrack(Track& tr, uint32_t channels, uint32_t got, float gain);
  void FeedBuses(uint32_t take, bool any_solo);
  void RunBuses(float* output, uint32_t take, uint32_t frame_count);
  bool SongEndReached(int64_t out_frame) const;
  uint32_t AudibleFrames(int64_t first, uint32_t frame_count) const;
  void AdvanceStretch(uint32_t take, uint32_t frame_count);
  void BlendSeam(float* output, uint32_t frame_count);
  void StretchBlock(float* output, uint32_t frame_count, bool any_solo);

  Track tracks_[kMaxTracks];
  // Written by the load path while the callback reads them; atomic so armv7
  // cannot tear them (#23). Relaxed: the source crosses by the publisher.
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
  RtPublisher<KeyBusSlot> buses_[kKeyBusCount];
  float sample_rate_;
  // App thread: what the callback will hold once the ring drains.
  int app_pitch_[kMaxTracks] = {};
  float app_rate_ = kUnityRate;
  bool app_engaged_ = false;
  bool app_vendor_default_ = false;
  // Callback-owned stretch state.
  float rate_target_ = kUnityRate;
  float rate_ = kUnityRate;
  double carry_ = 0.0;
  int64_t out_clock_ = 0;
  bool bypass_continues_ = false;
  int64_t seam_left_ = 0;
  SongRecords records_;
  std::atomic<bool> engaged_{false};
  std::atomic<float> rate_mirror_{kUnityRate};
  // App thread only. Counts commands dropped because the ring was full; a
  // diagnostic, since a full ring drops rather than blocks (see Enqueue).
  uint64_t dropped_commands_ = 0;
};

}  // namespace kitbag

#endif  // KITBAG_MIXER_MIXER_H
