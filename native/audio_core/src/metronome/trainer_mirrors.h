#ifndef KITBAG_METRONOME_TRAINER_MIRRORS_H
#define KITBAG_METRONOME_TRAINER_MIRRORS_H

#include <atomic>
#include <cstdint>

#include "metronome/tempo_ramp.h"

namespace kitbag {

// Each field is an independent relaxed mirror, so a reader polling several may
// straddle one block's publish.
class TrainerMirrors {
 public:
  void Publish(
      int32_t bar_mute_position,
      int32_t count_in_bar,
      const RampStatus& ramp
  ) {
    bar_mute_position_.store(bar_mute_position, std::memory_order_relaxed);
    count_in_bar_.store(count_in_bar, std::memory_order_relaxed);
    ramp_state_.store(ramp.state, std::memory_order_relaxed);
    ramp_next_bpm_.store(ramp.next_bpm, std::memory_order_relaxed);
    ramp_remaining_.store(ramp.remaining, std::memory_order_relaxed);
    ramp_step_progress_.store(ramp.progress, std::memory_order_relaxed);
  }
  int32_t bar_mute_position() const {
    return bar_mute_position_.load(std::memory_order_relaxed);
  }
  int32_t count_in_bar() const {
    return count_in_bar_.load(std::memory_order_relaxed);
  }
  RampState ramp_state() const {
    return ramp_state_.load(std::memory_order_relaxed);
  }
  double ramp_next_bpm() const {
    return ramp_next_bpm_.load(std::memory_order_relaxed);
  }
  double ramp_remaining() const {
    return ramp_remaining_.load(std::memory_order_relaxed);
  }
  double ramp_step_progress() const {
    return ramp_step_progress_.load(std::memory_order_relaxed);
  }

 private:
  std::atomic<int32_t> bar_mute_position_{-1};
  std::atomic<int32_t> count_in_bar_{-1};
  std::atomic<RampState> ramp_state_{RampState::kOff};
  std::atomic<double> ramp_next_bpm_{0.0};
  std::atomic<double> ramp_remaining_{0.0};
  std::atomic<double> ramp_step_progress_{0.0};
};

}  // namespace kitbag

#endif  // KITBAG_METRONOME_TRAINER_MIRRORS_H
