#include "kitbag_api.h"

#include <cmath>
#include <cstdint>
#include <vector>

#include "analysis/constant_tempo.h"

namespace {

bool ValidBeats(const float* beats, int32_t count) {
  if (beats == nullptr || count < 2 || count > KB_MAX_GRID_BEATS) return false;
  for (int32_t i = 0; i < count; ++i) {
    if (!std::isfinite(beats[i])) return false;
    if (i > 0 && !(beats[i] > beats[i - 1])) return false;
  }
  return true;
}

bool ValidDownbeats(const int32_t* indices, int32_t count, int32_t beat_count) {
  if (count < 0 || count > beat_count) return false;
  if (count > 0 && indices == nullptr) return false;
  for (int32_t i = 0; i < count; ++i) {
    if (indices[i] < 0 || indices[i] >= beat_count) return false;
  }
  return true;
}

kb_result Fit(
    const float* beat_times,
    int32_t beat_count,
    const int32_t* downbeat_indices,
    int32_t downbeat_count,
    kitbag::ConstantTempo* out
) {
  if (!ValidBeats(beat_times, beat_count) ||
      !ValidDownbeats(downbeat_indices, downbeat_count, beat_count)) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  const std::vector<float> beats(beat_times, beat_times + beat_count);
  const std::vector<int> downbeats(
      downbeat_indices,
      downbeat_indices + downbeat_count
  );
  return kitbag::FitConstantTempo(beats, downbeats, out)
             ? KB_OK
             : KB_ERROR_INVALID_ARGUMENT;
}

}  // namespace

extern "C" {

kb_result kb_fit_constant_tempo(
    const float* beat_times,
    int32_t beat_count,
    const int32_t* downbeat_indices,
    int32_t downbeat_count,
    float* bpm_out,
    double* anchor_sec_out,
    int32_t* beats_per_bar_out
) {
  if (bpm_out != nullptr) *bpm_out = 0.0f;
  if (anchor_sec_out != nullptr) *anchor_sec_out = 0.0;
  if (beats_per_bar_out != nullptr) *beats_per_bar_out = 0;
  if (bpm_out == nullptr || anchor_sec_out == nullptr ||
      beats_per_bar_out == nullptr) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  kitbag::ConstantTempo fit;
  try {
    const kb_result status =
        Fit(beat_times, beat_count, downbeat_indices, downbeat_count, &fit);
    if (status != KB_OK) return status;
  } catch (...) {
    return KB_ERROR_INTERNAL;
  }
  *bpm_out = static_cast<float>(fit.bpm);
  *anchor_sec_out = fit.anchor_sec;
  *beats_per_bar_out = fit.beats_per_bar;
  return KB_OK;
}

}  // extern "C"
