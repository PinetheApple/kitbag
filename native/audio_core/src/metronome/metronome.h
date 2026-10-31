#ifndef KITBAG_METRONOME_METRONOME_H
#define KITBAG_METRONOME_METRONOME_H

#include <atomic>
#include <cstdint>
#include <limits>
#include <memory>
#include <span>

#include "kitbag_metronome_poly_api.h"
#include "media/loop_layout.h"
#include "metronome/click_voices.h"
#include "metronome/metronome_types.h"
#include "metronome/rig_click.h"
#include "metronome/tempo_ramp.h"
#include "metronome/trainer_mirrors.h"
#include "rt/rt_publisher.h"
#include "rt/spsc_ring.h"

namespace kitbag {

// Position is a fractional beat index advanced per sample, so a tempo change
// alters the increment and never the phase. SPEC.md §4.2.
class Metronome {
 public:
  static constexpr int kMaxBeats = 16;
  static constexpr int kMinSubdivision = 1;
  static constexpr int kMaxSubdivision = 16;
  static constexpr int kMinPolyBeats = 2;
  static constexpr int kMaxPolyBeats = 16;
  static constexpr int kMinPolyAgainst = 1;
  static constexpr int kMaxPolyAgainst = kMaxBeats;
  static constexpr int kSoundCount = 6;
  // BPM stays quarter-note referenced whatever the time signature, so the beat
  // interval is (60 / bpm) * (kBpmReferenceDenominator / denominator) seconds.
  static constexpr int kBpmReferenceDenominator = 4;
  static constexpr int kDenominators[] = {2, 4, 8, 16};
  static constexpr int kCountInOff = 0;
  static constexpr int kCountInBarChoices[] = {kCountInOff, 1, 2, 4};
  static constexpr int kDefaultNormalSound = 0;
  static constexpr int kDefaultAccentSound = 0;
  static constexpr int kDefaultCountInSound = 1;
  static constexpr int kMinMuteBars = 1;
  static constexpr int kMaxMuteBars = 16;
  // Output-latency compensation bound (D5). Widening this to 300 is the whole
  // of D5's clamp change; see SPEC.md §4.7 for what moves with it.
  static constexpr double kMaxLatencyOffsetMs = 100.0;
  static constexpr double kDefaultBpm = 120.0;
  static constexpr double kMinVolume = 0.0;
  static constexpr double kMaxVolume = 2.0;

  Metronome() {
    InitAccentRow(accents_);
    InitAccentRow(poly_accents_);
  }

  // RT-safe; adds into interleaved stereo. `block_start_frame` is the engine
  // frame of output[0] (SPEC.md §4.2); `song` is read only when following.
  void Render(
      float* output,
      uint32_t frame_count,
      uint32_t sample_rate,
      uint32_t channel_count,
      uint64_t block_start_frame,
      const SongClock* song = nullptr
  );

  // App-thread API. Non-blocking; drops commands if the ring is full.
  void Start();
  void StartAt(uint64_t start_frame);
  void Stop();
  void Pause();
  void AnchorExternal(double song_pos_sec, uint64_t at_frame, double bpm);
  void SetTempo(double bpm);
  void SetTimeSignature(int numerator, int denominator);
  void SetSubdivision(int subdivision);
  void SetSubdivisionAccents(int subdivision, int32_t slot_mask);
  void SetAccent(int beat_index, int32_t accent);
  void SetAccent(int beat_index, Accent accent) {
    SetAccent(beat_index, static_cast<int32_t>(accent));
  }
  void SetPolyrhythm(bool enabled, int beats);
  void SetPolyAccent(int beat_index, int32_t accent);
  void SetPolyAgainst(int main_beats);
  void SetPolyAccent(int beat_index, Accent accent) {
    SetPolyAccent(beat_index, static_cast<int32_t>(accent));
  }
  void SetSounds(int normal_sound, int accent_sound);
  void SetCountIn(int bars, bool distinct, int sound);
  void PreviewSound(int sound, bool accented);
  void SetVolume(double volume);
  void SetLatencyOffset(double latency_ms);
  // SetTempo cancels the ramp; Start replays it.
  void SetRamp(
      bool enabled,
      double start_bpm,
      double target_bpm,
      double step_bpm,
      double interval,
      int32_t unit,
      bool loop
  );
  // Bar-mute trainer: `play_bars` sounding then `mute_bars` silent, repeating
  // from bar 0. A muted bar silences every voice; the LEDs keep moving.
  void SetBarMute(bool enabled, int play_bars, int mute_bars);
  void SetFollowMixer(bool enabled);

  // `now_frame` dates the outgoing grid for reclamation; `engine_running` must
  // be true whenever the callback can run. Allocates on the app thread only.
  void SetGrid(
      std::unique_ptr<BeatGrid> grid,
      uint64_t now_frame,
      bool engine_running
  );
  // Return to constant-tempo mode, keeping the click's phase: the first bpm_
  // click falls one whole beat after the last grid beat (SPEC.md §4.2.1).
  void ClearGrid(uint64_t now_frame, bool engine_running);
  // The audio callback must be stopped.
  void ReleaseRetiredGrids();
  void DropQueuedPreviews();

  bool is_running() const {
    return running_flag_.load(std::memory_order_relaxed);
  }
  int32_t current_beat() const {
    return current_beat_.load(std::memory_order_relaxed);
  }
  int32_t current_poly_beat() const {
    return current_poly_beat_.load(std::memory_order_relaxed);
  }
  double poly_downbeat_phase() const {
    return poly_downbeat_phase_.load(std::memory_order_relaxed);
  }
  double bar_phase() const {
    return bar_phase_.load(std::memory_order_relaxed);
  }
  double current_bpm() const {
    return current_bpm_.load(std::memory_order_relaxed);
  }
  const TrainerMirrors& trainer_mirrors() const {
    return trainer_mirrors_;
  }
  RigClick& rig_click() {
    return rig_click_;
  }
  const RigClick& rig_click() const {
    return rig_click_;
  }

 private:
  enum class CommandType : uint8_t {
    kStart,
    kStartAt,
    kStop,
    kPause,
    kAnchorExternal,
    kSetTempo,
    kSetBeats,
    kSetSubdivision,
    kSetSubdivisionAccents,
    kSetAccent,
    kSetPoly,
    kSetPolyAccent,
    kSetPolyAgainst,
    kSetSounds,
    kSetCountIn,
    kPreviewSound,
    kSetRamp,
    kSetBarMute,
    kSetVolume,
    kSetLatencyOffset,
    kSetFollowMixer,
  };

  struct Command {
    CommandType type;
    double value = 0.0;
    double value_b = 0.0;
    double value_c = 0.0;
    double value_d = 0.0;
    int32_t int_a = 0;
    int32_t int_b = 0;
    int32_t int_c = 0;
    uint64_t frame = 0;  // engine-clock frame for kStartAt (see StartAt / §4.2)
  };

  // Per-block tempo derivatives, recomputed whenever bpm_ changes mid-block.
  struct BlockTempo {
    double beats_per_sample = 0.0;
    double latency_beats = 0.0;
    double poly_ticks_per_beat = 1.0;
  };

  // The block's grid and its identity, from one acquire load (SPEC.md §4.2.1).
  struct GridView {
    const BeatGrid* grid = nullptr;
    uint64_t generation = 0;
  };

  static constexpr int64_t kReseedFollow = -1;
  static constexpr size_t kCommandRingSize = 128;

  // ApplyCommand holds the only exhaustive switch over CommandType; the
  // handlers below are partial and say so with a `default:`.
  void ApplyPendingCommands();
  void ApplyCommand(const Command& command);
  bool RouteCommand(const Command& command);
  bool ApplyTransportCommand(const Command& command);
  void ReacquireGrid();
  void StashPendingAnchor(const Command& command);
  bool ApplyClockCommand(const Command& command);
  bool ApplyTrainerCommand(const Command& command);
  bool ApplyPatternCommand(const Command& command);
  bool ApplyOutputCommand(const Command& command);
  static bool IsValidSound(int32_t sound) {
    return sound >= 0 && sound < kSoundCount;
  }
  static void InitAccentRow(std::span<Accent> row);
  static void
  SetAccentSlot(std::span<Accent> row, int32_t length, const Command& command);
  static void
  ResetGrownSlots(std::span<Accent> row, int32_t old_count, int32_t new_count);
  void SetSignatureState(int32_t numerator, int32_t denominator);
  void SetSubdivisionAccentRow(int32_t subdivision, int32_t slot_mask);
  void SetSoundsState(int32_t normal_sound, int32_t accent_sound);
  void QueuePreview(const Command& command);
  void SetCountInState(const Command& command);
  void SetPolyState(bool enabled, int32_t beats);
  void SetPolyAgainstState(int32_t main_beats);
  void ArmRamp(const Command& command);
  // Phase-preserving like a bpm change; inert while stopped, where there is no
  // phase to hold and kStart re-anchors from the offset. SPEC.md §4.7.
  void SetLatencyPreservingPhase(double latency_ms);
  void StopRun();
  void PauseRun();
  void ArmCountIn();
  void CancelCountIn();
  double AdvanceCountIn(
      double position,
      const BlockTempo& tempo,
      uint32_t sample_rate
  );
  void OnCountInBeat(int64_t beat, uint32_t sample_rate);

  void TriggerPreset(int sound, bool accented, uint32_t sample_rate);
  void OnBeatBoundary(int beat_index, uint32_t sample_rate);
  void OnSubdivisionTick(int64_t owning_beat, int slot, uint32_t sample_rate);
  void TriggerSubdivision(int subdivision, int slot, uint32_t sample_rate);
  bool SubdivisionSlotAccented(int subdivision, int slot) const;
  void OnRigTick(int slot, uint32_t sample_rate);
  uint16_t& AccentRowFor(int subdivision);
  uint16_t AccentRowFor(int subdivision) const;
  void OnPolyBoundary(int poly_index, uint32_t sample_rate);
  bool BarIsMuted(int64_t bar) const;
  double LatencyBeats() const;
  double BeatUnitScale() const;
  // The only ways bpm_ and denominator_ may change while running. See
  // SetBeatRate's definition.
  void SetBpmPreservingPhase(double new_bpm);
  void SetDenominatorPreservingPhase(int32_t denominator);
  void SetBeatRate(double new_bpm, int new_denominator);
  void BeginRun();

  BlockTempo BlockTempoFor(uint32_t sample_rate) const;
  GridView BeginBlock(
      uint64_t block_start_frame,
      uint32_t sample_rate,
      BlockTempo* tempo
  );
  GridView AcquireGrid(uint64_t block_start_frame, uint32_t sample_rate);
  void BeginPendingStart(
      const GridView& view,
      uint64_t frame,
      uint32_t sample_rate,
      BlockTempo* tempo
  );
  // Writes bpm_ and beat_position_ so `now` sits at the song's beat phase.
  void
  BeginAnchorExternal(uint64_t now, uint32_t sample_rate, BlockTempo* tempo);
  // Derives current_bar_ from the current latency-shifted position, so an anchor
  // lands the bar counter on the song's bar rather than counting downbeats.
  void SyncBarFromPosition(double beats_per_sample);
  int64_t LastSoundedBeat(double beats_per_sample) const;
  void AdvanceConstantTempo(uint32_t sample_rate, BlockTempo* tempo);
  void FireConstantTempoTick(
      int64_t sub_index,
      uint32_t sample_rate,
      BlockTempo* tempo
  );
  int EffectivePolyAgainst() const;
  double PolyDownbeatPhase(bool gridded, double beats_per_sample) const;
  void PublishBlockMirrors(
      const BeatGrid* grid,
      uint64_t frame,
      uint32_t sample_rate
  );
  void PublishTrainerMirrors(bool gridded, uint32_t sample_rate);

  void RenderGridBeat(
      const BeatGrid& grid,
      double song_seconds,
      uint32_t sample_rate
  );
  void RenderGridSample(
      const BeatGrid& grid,
      const SongClock* song,
      uint64_t now,
      uint32_t frame,
      uint32_t sample_rate
  );
  void RenderGridSubdivision(
      const BeatGrid& grid,
      double song_seconds,
      uint32_t sample_rate
  );
  // Song position of an engine frame, shifted by the latency offset so the
  // click lands on the beat at the speaker rather than at the buffer (§4.7).
  double
  GridSeconds(const BeatGrid& grid, uint64_t frame, uint32_t sample_rate) const;
  // Places grid_cursor_ on the first beat at or after `song_seconds`. Binary
  // search — bounded and allocation-free, so it is safe from the callback.
  void SeekGridCursor(const BeatGrid& grid, double song_seconds);
  void SyncGridBar();
  void PublishGridMirrors(const BeatGrid& grid, double song_seconds);

  SpscRing<Command, kCommandRingSize> commands_;

  // RT-owned: touched only inside Render.
  bool running_ = false;
  double bpm_ = kDefaultBpm;
  int beats_per_bar_ = 4;
  int denominator_ = kBpmReferenceDenominator;
  int subdivision_ = kMinSubdivision;
  static_assert(kMaxSubdivision <= std::numeric_limits<uint16_t>::digits);
  uint16_t subdivision_accents_[kMaxSubdivision] = {};
  Accent accents_[kMaxBeats] = {};
  bool poly_enabled_ = false;
  int poly_beats_ = 3;
  int poly_against_ = KB_POLY_AGAINST_BAR;
  Accent poly_accents_[kMaxPolyBeats] = {};
  int normal_sound_ = kDefaultNormalSound;
  int accent_sound_ = kDefaultAccentSound;
  int count_in_bars_ = kCountInOff;
  bool count_in_distinct_ = true;
  int count_in_sound_ = kDefaultCountInSound;
  bool count_in_armed_ = true;
  int pending_preview_sound_ = -1;
  bool pending_preview_accented_ = false;
  bool counting_in_ = false;
  double count_in_beats_ = 0.0;
  int count_in_total_bars_ = 0;
  double beat_position_ = 0.0;  // fractional beats since start
  bool has_pending_start_ = false;
  uint64_t pending_start_frame_ = 0;
  // Held until the render loop knows block_start_frame. The last drained wins.
  bool has_pending_anchor_ = false;
  double pending_anchor_song_pos_ = 0.0;
  double pending_anchor_bpm_ = kDefaultBpm;
  uint64_t pending_anchor_frame_ = 0;

  // The publisher is the app→RT seam; everything below it is RT-owned. Why
  // identity is a generation and zero forces a re-seed: SPEC.md §4.2.1.
  RtPublisher<BeatGrid> grid_;
  uint64_t observed_generation_ = 0;
  size_t grid_cursor_ = 0;
  int64_t grid_beat_index_ = -1;
  // Next subdivision tick to fire inside the current beat interval, 1-based;
  // subdivision_ means "none left before the next beat".
  int grid_next_sub_ = 1;
  // Bar counter, -1 until the first downbeat after Start. Incremented at
  // constant tempo, derived from the grid in grid mode — SPEC.md §4.2.1.
  int64_t current_bar_ = -1;
  TempoRamp ramp_;
  bool mute_enabled_ = false;
  int play_bars_ = 3;
  int mute_bars_ = 1;
  double volume_ = 1.0;
  double latency_offset_ms_ = 0.0;
  ClickVoices voices_;
  RigClick rig_click_;
  bool follow_mixer_ = false;
  // Any other song frame, a seek or a loop wrap, reseeds the cursor.
  int64_t follow_next_frame_ = kReseedFollow;
  double follow_seconds_ = 0.0;
  // Grid beats after this song second wait: the loop's wrap owns that moment.
  double grid_fire_limit_ = std::numeric_limits<double>::infinity();

  std::atomic<int32_t> preview_epoch_{0};
  std::atomic<bool> running_flag_{false};
  std::atomic<int32_t> current_beat_{-1};
  std::atomic<int32_t> current_poly_beat_{-1};
  std::atomic<double> poly_downbeat_phase_{KB_POLY_PHASE_NONE};
  std::atomic<double> bar_phase_{0.0};
  std::atomic<double> current_bpm_{kDefaultBpm};
  TrainerMirrors trainer_mirrors_;
};

}  // namespace kitbag

#endif  // KITBAG_METRONOME_METRONOME_H
