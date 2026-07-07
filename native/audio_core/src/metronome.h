#ifndef KITBAG_METRONOME_H
#define KITBAG_METRONOME_H

#include <atomic>
#include <cstdint>

#include "spsc_ring.h"

namespace kitbag {

// Per-beat accent states, mirrored by kb_accent in the C API.
enum class Accent : uint8_t { kMuted = 0, kNormal = 1, kAccented = 2 };

// Sample-accurate metronome sequencer driven from the audio callback.
//
// Position is tracked as a fractional beat index advanced per sample, so a
// tempo change only alters the increment — never the phase — which makes
// tempo ramps glitch-free by construction. App-thread mutations arrive
// through a lock-free SPSC command ring drained at the top of each block.
class Metronome {
 public:
  static constexpr int kMaxBeats = 16;
  static constexpr int kMaxSubdivision = 6;
  static constexpr int kMaxPolyBeats = 16;
  static constexpr int kSoundCount = 3;
  static constexpr double kMinBpm = 20.0;
  static constexpr double kMaxBpm = 400.0;

  Metronome() {
    accents_[0] = Accent::kAccented;
    for (int i = 1; i < kMaxBeats; ++i) {
      accents_[i] = Accent::kNormal;
    }
  }

  // Renders additively into an interleaved stereo buffer. RT-safe.
  void Render(float* output, uint32_t frame_count, uint32_t sample_rate,
              uint32_t channel_count);

  // App-thread API. Non-blocking; drops commands if the ring is full.
  void Start();
  void Stop();
  void SetTempo(double bpm);
  void SetBeatsPerBar(int beats);
  void SetSubdivision(int subdivision);
  void SetAccent(int beat_index, Accent accent);
  void SetPolyrhythm(bool enabled, int beats);
  void SetSound(int sound_index);

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

 private:
  enum class CommandType : uint8_t {
    kStart,
    kStop,
    kSetTempo,
    kSetBeats,
    kSetSubdivision,
    kSetAccent,
    kSetPoly,
    kSetSound,
  };

  struct Command {
    CommandType type;
    double value = 0.0;
    int32_t int_a = 0;
    int32_t int_b = 0;
  };

  struct Voice {
    bool active = false;
    double phase = 0.0;
    double phase_step = 0.0;
    double amplitude = 0.0;
    double decay_per_sample = 0.0;
  };

  static constexpr int kMaxVoices = 8;
  static constexpr size_t kCommandRingSize = 128;

  void ApplyPendingCommands();
  void TriggerClick(double frequency_hz, double amplitude,
                    double decay_per_second, uint32_t sample_rate);
  void OnBeatBoundary(int beat_index, uint32_t sample_rate);
  void OnSubdivisionTick(uint32_t sample_rate);
  void OnPolyBoundary(int poly_index, uint32_t sample_rate);
  float RenderVoices();

  SpscRing<Command, kCommandRingSize> commands_;

  // RT-owned sequencer state (touched only inside Render).
  bool running_ = false;
  double bpm_ = 120.0;
  int beats_per_bar_ = 4;
  int subdivision_ = 1;
  Accent accents_[kMaxBeats] = {};
  bool poly_enabled_ = false;
  int poly_beats_ = 3;
  int sound_ = 0;
  double beat_position_ = 0.0;  // fractional beats since start
  Voice voices_[kMaxVoices];

  // UI-visible mirrors.
  std::atomic<bool> running_flag_{false};
  std::atomic<int32_t> current_beat_{-1};
  std::atomic<int32_t> current_poly_beat_{-1};
  std::atomic<double> bar_phase_{0.0};
};

}  // namespace kitbag

#endif  // KITBAG_METRONOME_H
