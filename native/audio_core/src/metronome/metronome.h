#ifndef KITBAG_METRONOME_METRONOME_H
#define KITBAG_METRONOME_METRONOME_H

#include <atomic>
#include <cstdint>
#include <memory>
#include <vector>

#include "rt/rt_publisher.h"
#include "rt/spsc_ring.h"

namespace kitbag {

// Per-beat accent states, mirrored by kb_accent in the C API.
enum class Accent : uint8_t { kMuted = 0, kNormal = 1, kAccented = 2 };

// A song's measured beat times, replacing a single BPM: following per-beat
// spacing is what makes a non-constant-tempo song work (SPEC.md §4.2).
struct BeatGrid {
  std::vector<double> beat_times_sec;  // strictly ascending
  // Engine frame that beat_times_sec[0]'s zero is measured from: song second t
  // falls on engine frame anchor_frame + t * sample_rate.
  uint64_t anchor_frame = 0;
};

// Sample-accurate metronome sequencer driven from the audio callback. Position
// is a fractional beat index advanced per sample, so a tempo change alters the
// increment and never the phase; app-thread mutations arrive through a
// lock-free SPSC ring drained at the top of each block. SPEC.md §4.2.
class Metronome {
 public:
  static constexpr int kMaxBeats = 16;
  static constexpr int kMaxSubdivision = 16;
  static constexpr int kMaxPolyBeats = 16;
  static constexpr int kSoundCount = 6;
  static constexpr double kMinBpm = 20.0;
  static constexpr double kMaxBpm = 400.0;
  static constexpr int kMaxRampBars = 64;
  static constexpr int kMaxMuteBars = 16;
  // Output-latency compensation bound (D5). Widening this to 300 is the whole
  // of D5's clamp change; see SPEC.md §4.7 for what moves with it.
  static constexpr double kMaxLatencyOffsetMs = 100.0;
  static constexpr double kDefaultBpm = 120.0;
  static constexpr double kMaxVolume = 2.0;

  Metronome() {
    accents_[0] = Accent::kAccented;
    for (int i = 1; i < kMaxBeats; ++i) {
      accents_[i] = Accent::kNormal;
    }
  }

  // Renders additively into an interleaved stereo buffer. RT-safe.
  // `block_start_frame` is the engine-clock frame of output[0] — the shared
  // transport that lets StartAt land on an exact frame (SPEC.md §4.2).
  void Render(
      float* output,
      uint32_t frame_count,
      uint32_t sample_rate,
      uint32_t channel_count,
      uint64_t block_start_frame
  );

  // App-thread API. Non-blocking; drops commands if the ring is full.
  void Start();
  // Sample-accurate start on engine frame `start_frame` (cf.
  // Engine::frames_rendered). Only takes effect while stopped; an already-past
  // frame starts on the next sample, never before the transport. SPEC.md §4.2.
  void StartAt(uint64_t start_frame);
  void Stop();
  void SetTempo(double bpm);
  void SetBeatsPerBar(int beats);
  void SetSubdivision(int subdivision);
  void SetAccent(int beat_index, Accent accent);
  void SetPolyrhythm(bool enabled, int beats);
  void SetSound(int sound_index);
  void SetVolume(double volume);
  void SetLatencyOffset(double latency_ms);
  // Tempo ramp trainer: steps the BPM once per bar from start to end over
  // `bars` bars, then holds. SetTempo cancels it; Start replays it.
  void SetRamp(bool enabled, double start_bpm, double end_bpm, int bars);
  // Bar-mute trainer: `play_bars` sounding then `mute_bars` silent, repeating
  // from bar 0. A muted bar silences every voice; the LEDs keep moving.
  void SetBarMute(bool enabled, int play_bars, int mute_bars);

  // Follow a measured beat grid instead of bpm_. `now_frame` only dates the
  // outgoing grid for reclamation; `engine_running` must be true whenever the
  // callback can run, so a retired grid can be freed at once rather than
  // waiting on a clock that is not moving. Allocates on the app thread only.
  void SetGrid(
      std::unique_ptr<BeatGrid> grid,
      uint64_t now_frame,
      bool engine_running
  );
  // Return to constant-tempo mode, keeping the click's phase: the first bpm_
  // click falls one whole beat after the last grid beat (SPEC.md §4.2.1).
  void ClearGrid(uint64_t now_frame, bool engine_running);
  // Frees grids retired while the clock was not advancing. The caller must
  // guarantee the audio callback is stopped — Engine::Stop is that caller.
  void ReleaseRetiredGrids();

  bool is_running() const {
    return running_flag_.load(std::memory_order_relaxed);
  }
  // Beat index within the bar, or -1 when stopped. UI polls this.
  int32_t current_beat() const {
    return current_beat_.load(std::memory_order_relaxed);
  }
  int32_t current_poly_beat() const {
    return current_poly_beat_.load(std::memory_order_relaxed);
  }
  // Position within the bar, [0, 1). Updated once per render block.
  double bar_phase() const {
    return bar_phase_.load(std::memory_order_relaxed);
  }
  // Effective BPM, including ramp progress. UI polls this.
  double current_bpm() const {
    return current_bpm_.load(std::memory_order_relaxed);
  }
  // True while the current bar is silenced by the bar-mute trainer.
  bool bar_muted() const {
    return bar_muted_flag_.load(std::memory_order_relaxed);
  }

 private:
  enum class CommandType : uint8_t {
    kStart,
    kStartAt,
    kStop,
    kSetTempo,
    kSetBeats,
    kSetSubdivision,
    kSetAccent,
    kSetPoly,
    kSetSound,
    kSetRamp,
    kSetBarMute,
    kSetVolume,
    kSetLatencyOffset,
  };

  struct Command {
    CommandType type;
    double value = 0.0;
    double value_b = 0.0;
    int32_t int_a = 0;
    int32_t int_b = 0;
    int32_t int_c = 0;
    uint64_t frame = 0;  // engine-clock frame for kStartAt (see StartAt / §4.2)
  };

  struct Voice {
    bool active = false;
    double phase = 0.0;
    double phase_step = 0.0;
    double amplitude = 0.0;
    double decay_per_sample = 0.0;
  };

  // Per-block tempo derivatives, recomputed whenever bpm_ changes mid-block.
  struct BlockTempo {
    double beats_per_sample = 0.0;
    double latency_beats = 0.0;
    double poly_scale = 1.0;
  };

  // The block's grid and its identity, from one acquire load (SPEC.md §4.2.1).
  struct GridView {
    const BeatGrid* grid = nullptr;
    uint64_t generation = 0;
  };

  static constexpr int kMaxVoices = 8;
  static constexpr size_t kCommandRingSize = 128;

  // Command drain. ApplyCommand holds the only exhaustive switch over
  // CommandType; the handlers below are partial by design and say so with a
  // `default:`, and each reports whether it consumed the command.
  void ApplyPendingCommands();
  void ApplyCommand(const Command& command);
  bool ApplyTransportCommand(const Command& command);
  bool ApplyTempoCommand(const Command& command);
  bool ApplyTrainerCommand(const Command& command);
  bool ApplyPatternCommand(const Command& command);
  void SetAccentSlot(int32_t beat_index, int32_t accent);
  void SetPolyState(bool enabled, int32_t beats);
  void ArmRamp(const Command& command);
  // Phase-preserving like a bpm change; inert while stopped, where there is no
  // phase to hold and kStart re-anchors from the offset. SPEC.md §4.7.
  void SetLatencyPreservingPhase(double latency_ms);
  void StopRun();

  void TriggerClick(
      double frequency_hz,
      double amplitude,
      double decay_per_second,
      uint32_t sample_rate
  );
  void OnBeatBoundary(int beat_index, uint32_t sample_rate);
  void OnSubdivisionTick(uint32_t sample_rate);
  void OnPolyBoundary(int poly_index, uint32_t sample_rate);
  float RenderVoices();
  double RampBpmForBar(int64_t bar) const;
  bool BarIsMuted(int64_t bar) const;
  double LatencyBeats() const;
  // The only way bpm_ may change while running. See the definition.
  void SetBpmPreservingPhase(double new_bpm);
  // Resets sequencer phase and starts the run. Shared by Start (immediate) and
  // StartAt (deferred to the anchor frame).
  void BeginRun();

  // Render internals. All called per block or per sample from the callback.
  BlockTempo BlockTempoFor(uint32_t sample_rate) const;
  GridView AcquireGrid(uint64_t block_start_frame, uint32_t sample_rate);
  void BeginPendingStart(
      const GridView& view,
      uint64_t frame,
      uint32_t sample_rate,
      BlockTempo* tempo
  );
  void AdvanceConstantTempo(uint32_t sample_rate, BlockTempo* tempo);
  void FireConstantTempoTick(
      int64_t sub_index,
      uint32_t sample_rate,
      BlockTempo* tempo
  );
  void
  FirePolyTick(double position, uint32_t sample_rate, const BlockTempo& tempo);
  void PublishBlockMirrors(
      const BeatGrid* grid,
      uint64_t frame,
      uint32_t sample_rate
  );

  // Grid mode: fires the grid's beat if this sample crosses one.
  void
  RenderGridBeat(const BeatGrid& grid, uint64_t frame, uint32_t sample_rate);
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
  // Grid mode: derives current_bar_ from grid_beat_index_. See the definition.
  void SyncGridBar();
  // Publishes bar_phase_/current_bpm_ from the grid's local beat spacing.
  void PublishGridMirrors(
      const BeatGrid& grid,
      uint64_t frame,
      uint32_t sample_rate
  );

  SpscRing<Command, kCommandRingSize> commands_;

  // RT-owned sequencer state (touched only inside Render).
  bool running_ = false;
  double bpm_ = kDefaultBpm;
  int beats_per_bar_ = 4;
  int subdivision_ = 1;
  Accent accents_[kMaxBeats] = {};
  bool poly_enabled_ = false;
  int poly_beats_ = 3;
  int sound_ = 0;
  double beat_position_ = 0.0;  // fractional beats since start
  // Pending sample-accurate start (StartAt). Held until the render loop reaches
  // `pending_start_frame_` on the engine clock, then consumed by BeginRun.
  bool has_pending_start_ = false;
  uint64_t pending_start_frame_ = 0;

  // Grid mode. The publisher is the app→RT seam; everything below it is
  // RT-owned. Why identity is a generation, why zero forces a re-seed, and why
  // the bar is derived here but incremented at constant tempo: SPEC.md §4.2.1.
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
  bool ramp_enabled_ = false;
  double ramp_start_bpm_ = 0.0;
  double ramp_end_bpm_ = 0.0;
  int ramp_bars_ = 1;
  int64_t ramp_start_bar_ = 0;
  bool mute_enabled_ = false;
  int play_bars_ = 3;
  int mute_bars_ = 1;
  double volume_ = 1.0;
  double latency_offset_ms_ = 0.0;
  Voice voices_[kMaxVoices];

  // UI-visible mirrors.
  std::atomic<bool> running_flag_{false};
  std::atomic<int32_t> current_beat_{-1};
  std::atomic<int32_t> current_poly_beat_{-1};
  std::atomic<double> bar_phase_{0.0};
  std::atomic<double> current_bpm_{kDefaultBpm};
  std::atomic<bool> bar_muted_flag_{false};
};

}  // namespace kitbag

#endif  // KITBAG_METRONOME_METRONOME_H
