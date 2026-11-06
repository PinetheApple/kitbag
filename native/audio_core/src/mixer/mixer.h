#ifndef KITBAG_MIXER_MIXER_H
#define KITBAG_MIXER_MIXER_H

#include <atomic>
#include <cstdint>
#include <functional>
#include <memory>
#include <optional>
#include <utility>
#include <vector>

#include "media/song_clock.h"
#include "media/streaming_track.h"
#include "mixer/key_bus.h"
#include "mixer/mixer_command.h"
#include "mixer/mixer_track.h"
#include "mixer/transport_plan.h"
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
  static constexpr float kMinRate = 0.5f;
  static constexpr float kMaxRate = 1.0f;
  static constexpr int kMinPitchSemitones = -6;
  static constexpr int kMaxPitchSemitones = 6;
  static constexpr int kKeyBusCount =
      kMaxPitchSemitones - kMinPitchSemitones + 1;
  // Covers the app-thread pre-roll reads and OutputSeek after the switch point
  // is picked (~12 ms for 4 buses on the host bench); a miss retries longer.
  static constexpr double kHandOverLeadSeconds = 0.15;
  static constexpr int kHandOverAttempts = 3;

  explicit Mixer(uint32_t engine_rate);
  ~Mixer() = default;
  Mixer(const Mixer&) = delete;
  Mixer& operator=(const Mixer&) = delete;

  /// Load a track from a file path, streamed from disk and published by atomic
  /// swap (SPEC.md §4.1). [now_frame] and [engine_running] date the retired
  /// source for deferred reclamation. False for a null path, a track outside
  /// [0, kMaxTracks), or a file that will not open.
  bool LoadTrack(
      int track,
      const char* path,
      uint64_t now_frame,
      bool engine_running
  );

  /// Retire a track's source, reclaimed off the callback; the transport length
  /// follows the longest remaining track (B5).
  void UnloadTrack(int track, uint64_t now_frame, bool engine_running);

  void ReserveCallbackFrames(uint32_t frames);

  bool track_ready(int track) const;

  /// [reader] is caller-owned and must outlive the track.
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

  /// Speed (SPEC.md §7.6), clamped to [kMinRate, kMaxRate].
  void SetRate(float rate, uint64_t now_frame, bool engine_running);
  /// Whole semitones, clamped to [kMinPitchSemitones, kMaxPitchSemitones].
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
  /// App thread only. Both banks, so a bank left behind by a prime counts.
  int key_bus_count() const;
  bool key_buses_vendor_default() const {
    return app_vendor_default_;
  }
  /// Frames each track's read-ahead ring holds, stretch pre-roll included.
  uint64_t ring_frames() const;
  int64_t handover_lead_frames() const {
    return handover_lead_frames_;
  }
  /// Tests only: the lead of the next hand-over's first attempt.
  void set_first_handover_lead_frames(int64_t frames) {
    first_lead_frames_ = frames;
  }
  /// Tests only: runs between building a hand-over's bank and publishing it.
  void set_handover_publish_hook(std::function<void()> hook) {
    handover_publish_hook_ = std::move(hook);
  }
  /// Tests only: runs on the callback between adopting a plan and loading the
  /// block's buses.
  void set_snapshot_hook(std::function<void()> hook) {
    snapshot_hook_ = std::move(hook);
  }
  uint64_t missed_handovers() const {
    return missed_handovers_;
  }

  /// Callback-published mirrors: they converge within one block.
  bool is_playing() const {
    return playing_.load(std::memory_order_relaxed);
  }
  uint64_t position() const {
    return read_frame_.load(std::memory_order_relaxed);
  }

  /// RT-safe: allocates nothing, takes no lock, frees nothing.
  void Process(float* output, uint32_t frame_count);
  const SongClock& song_clock() const {
    return song_clock_;
  }

  /// Highest loaded track index + 1: unload never lowers it, since the
  /// callback must still cover a published track above an unloaded gap.
  int active_track_count() const {
    return track_count_.load(std::memory_order_relaxed);
  }
  uint64_t dropped_commands() const {
    return dropped_commands_;
  }
  uint64_t track_frames(int track) const;
  /// App thread. Frames buffered ahead in a track's source.
  uint64_t track_buffered(int track) const;
  /// Realtime-safe sibling of track_buffered, so a concurrent test can observe
  /// a ring the callback drains (#25).
  uint64_t rt_track_buffered(int track) const;
  bool track_at_end(int track) const;

  /// App thread, callback quiescent. Frees every retired source now.
  void ReleaseRetiredSources();

 private:
  using Track = MixerTrack;
  using CommandType = MixerCommandType;
  using Command = MixerCommand;

  static constexpr size_t kCommandRingSize = 64;
  static constexpr int kBanks = 2;
  // A pending rate waits this long after the last record, which bounds how
  // many records the clock needs to cover the stretch's output latency.
  static constexpr int64_t kMinRecordSpacingFrames = 512;

  static float ClampRate(float rate);
  static int ClampPitch(float semitones);

  void NoteTrackLoaded(int track);
  SourceStamp JoinStamp() const;
  void RecomputeLongestFrames();

  bool Enqueue(const Command& command);
  bool Relayout(TransportPlan plan, uint64_t now_frame, bool engine_running);
  bool
  PlainRelayout(TransportPlan plan, uint64_t now_frame, bool engine_running);
  void CommitPlan(
      const TransportPlan& plan,
      uint64_t now_frame,
      bool engine_running
  );
  bool StageAll(int64_t frame, const SourceStamp& stamp, bool engine_running);
  void DropStaged(int count);
  void
  ReplanStretch(TransportPlan plan, uint64_t now_frame, bool engine_running);
  int64_t SeekTarget(int64_t frame) const;
  struct Head {
    int64_t stream;
    int64_t transport;
    bool jump_pending;
  };
  // App thread. The head in the latest plan's stream frames, from the transport
  // clock alone so no two mirrors written in different blocks get paired.
  Head PlannedHead() const;

  // ApplyCommand holds the only exhaustive switch over CommandType, so a new
  // command is a -Wswitch error rather than a silent drop.
  void ApplyPendingCommands();
  void ApplyCommand(const Command& command);
  void ApplyStretchCommand(const Command& command);
  void RecomputeAnySolo();
  bool AdoptPlan();
  void AdoptTransport(const TransportPlan& plan);
  bool
  TransportFrameFor(const StreamingTrack::RtView& view, int64_t* frame) const;
  bool AlignTo(AudioSource& source, int64_t frame);

  void MixTrack(Track& tr, float* output, uint32_t frame_count, bool any_solo);
  void MixAllTracks(float* output, uint32_t frame_count, bool any_solo);
  void AdvanceTransport(uint32_t frame_count);

  struct Prepared {
    uint32_t created = 0;
    bool prime = false;
  };
  bool WantsStretch() const;
  std::unique_ptr<KeyBusSlot> MakeBus(int slot, uint64_t generation) const;
  bool MatchBusConfig(int in_use, bool allow_down);
  enum class BusChange : uint8_t { kAddedLive, kNeedsPrime };
  BusChange EngageBuses(
      std::optional<int> extra,
      uint64_t now_frame,
      bool engine_running
  );
  Prepared PrepareBusFor(int track, uint64_t now_frame, bool engine_running);
  void UndoPrepare(
      uint32_t created,
      bool was_engaged,
      uint64_t now_frame,
      bool engine_running
  );
  uint32_t LiveBusMask() const;
  int MarkUsedBuses(bool* used) const;
  int BusesInUse() const;
  void
  RetireDrainedBuses(const bool* used, uint64_t now_frame, bool engine_running);
  void FreeUnusedBuses(uint64_t now_frame, bool engine_running);

  struct Bank {
    std::unique_ptr<KeyBusSlot> slots[kKeyBusCount];
    uint64_t generation = 0;
    int64_t lag = 0;
  };
  void PrimeNow(uint64_t now_frame, bool engine_running);
  bool PrimeAwaitingEngage() const;
  int64_t HeadToPrime() const;
  bool
  PrimedRelayout(TransportPlan plan, uint64_t now_frame, bool engine_running);
  bool BuildBank(int64_t frame, bool staged, Bank* bank);
  bool ReadBankPreRoll(int64_t frame, bool staged, Bank* bank);
  void PublishBank(
      Bank* bank,
      TransportPlan* plan,
      uint64_t now_frame,
      bool engine_running
  );
  void
  AdoptBank(const TransportPlan& plan, uint64_t now_frame, bool engine_running);
  void FreeBank(int bank, uint64_t now_frame, bool engine_running);
  enum class HandOverOutcome : uint8_t { kTaken, kMissed, kJump };
  void HandOver(uint64_t now_frame, bool engine_running);
  HandOverOutcome TryHandOver(
      const Head& head,
      int64_t lead,
      uint64_t now_frame,
      bool engine_running
  );
  HandOverOutcome AwaitVerdict(uint64_t generation, bool engine_running) const;

  void SnapshotBuses();
  bool HoldForBusSwitch() const;
  bool BusesAgree(uint64_t generation) const;
  KeyBus* BusAt(int slot) const;
  KeyBus* AnyBus() const;
  void CountMembers(int* members) const;
  KeyBus* TrackBus(const Track& tr) const;
  float TrackGain(const Track& tr, bool any_solo) const;
  bool AlignedView(const Track& tr, StreamingTrack::RtView* view);
  void JudgeHandOver(const TransportPlan& plan);
  bool EngageAt(const TransportPlan& plan, int64_t bypass_frames);
  bool HandOverBlock(float* output, uint32_t frame_count, bool any_solo);
  void ResetRecords(const TimeStretch& stretch, int64_t bypass_frames);
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
  // Sized once at construction and never reallocated.
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
  uint64_t app_epoch_ = 0;
  bool landed_ = false;
  LoopLayout app_layout_;
  bool app_playing_ = false;
  int64_t crossfade_frames_;
  SpscRing<Command, kCommandRingSize> commands_;
  RtPublisher<KeyBusSlot> buses_[kBanks][kKeyBusCount];
  float sample_rate_;
  // App thread: what the callback will hold once the ring drains.
  int app_pitch_[kMaxTracks] = {};
  float app_rate_ = kUnityRate;
  bool app_engaged_ = false;
  bool app_vendor_default_ = false;
  // App thread: the bank the newest primed plan names, and its generation.
  int app_bank_ = 0;
  bool app_primed_ = false;
  uint64_t app_bus_generation_ = 0;
  uint64_t next_bus_generation_ = 0;
  int64_t handover_lead_frames_;
  int64_t first_lead_frames_ = 0;
  uint64_t missed_handovers_ = 0;
  std::function<void()> handover_publish_hook_;
  std::function<void()> snapshot_hook_;
  // Callback-owned stretch state. rt_buses_ is loaded once per block.
  int bank_ = 0;
  KeyBus* rt_buses_[kKeyBusCount] = {};
  uint64_t primed_generation_ = 0;
  TransportPlan handover_;
  bool handover_pending_ = false;
  std::atomic<uint64_t> seen_generation_{0};
  std::atomic<uint64_t> missed_generation_{0};
  float rate_target_ = kUnityRate;
  float rate_ = kUnityRate;
  double carry_ = 0.0;
  int64_t out_clock_ = 0;
  int64_t seam_left_ = 0;
  SongRecords records_;
  std::atomic<bool> engaged_{false};
  std::atomic<float> rate_mirror_{kUnityRate};
  uint64_t dropped_commands_ = 0;
};

}  // namespace kitbag

#endif  // KITBAG_MIXER_MIXER_H
