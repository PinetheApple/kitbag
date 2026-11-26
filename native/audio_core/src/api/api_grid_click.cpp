#include "kitbag_api.h"

#include <cstdint>
#include <span>

#include "api/api_engine.h"
#include "kitbag_metronome_grid_api.h"

using kitbag::ToEngine;

namespace {

static_assert(
    kitbag::Metronome::kMaxBeats < (1 << kitbag::GridClick::kGroupBits)
);

bool ValidGrouping(const int32_t* sizes, int32_t count) {
  if (count < 0 || count > KB_MAX_GRID_GROUPS) return false;
  if (count > 0 && sizes == nullptr) return false;
  int32_t sum = 0;
  for (int32_t i = 0; i < count; ++i) {
    if (sizes[i] < 1 || sizes[i] > kitbag::Metronome::kMaxBeats) return false;
    sum += sizes[i];
  }
  return sum <= kitbag::Metronome::kMaxBeats;
}

bool ValidDownbeatTable(const int32_t* downbeats, int32_t count) {
  return count == 0 || (count > 0 && downbeats != nullptr);
}

bool ValidRate(int32_t rate) {
  return rate == KB_GRID_RATE_SINGLE || rate == KB_GRID_RATE_DOUBLE ||
         rate == KB_GRID_RATE_HALF;
}

}  // namespace

extern "C" {

kb_result kb_metronome_set_grid_grouping(
    kb_engine* engine,
    const int32_t* sizes,
    int32_t count
) {
  if (engine == nullptr || !ValidGrouping(sizes, count)) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  kitbag::Metronome& metronome = ToEngine(engine)->metronome();
  if (!metronome.HasCommandRoom()) return KB_ERROR_BUSY;
  metronome.SetGridGrouping({sizes, static_cast<size_t>(count)});
  return KB_OK;
}

kb_result kb_metronome_set_grid_downbeats(
    kb_engine* engine,
    const int32_t* downbeat_indices,
    int32_t downbeat_count
) {
  if (engine == nullptr ||
      !ValidDownbeatTable(downbeat_indices, downbeat_count)) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  kitbag::Engine* target = ToEngine(engine);
  const bool published = target->metronome().SetGridDownbeats(
      {downbeat_indices, static_cast<size_t>(downbeat_count)},
      target->frame_clock(),
      target->is_running()
  );
  return published ? KB_OK : KB_ERROR_INVALID_ARGUMENT;
}

kb_result kb_metronome_set_grid_rate(kb_engine* engine, int32_t rate) {
  if (engine == nullptr || !ValidRate(rate)) return KB_ERROR_INVALID_ARGUMENT;
  kitbag::Metronome& metronome = ToEngine(engine)->metronome();
  if (!metronome.HasCommandRoom()) return KB_ERROR_BUSY;
  metronome.SetGridRate(rate);
  return KB_OK;
}

}  // extern "C"
