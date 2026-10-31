#include "kitbag_api.h"

#include <cmath>

#include "api/api_engine.h"

using kitbag::Metronome;
using kitbag::ToEngine;

namespace {

bool ValidRigClick(double bpm, int32_t subdivision, int64_t start_frame) {
  return std::isfinite(bpm) && bpm >= kitbag::kMinBpm &&
         bpm <= kitbag::kMaxBpm && subdivision >= Metronome::kMinSubdivision &&
         subdivision <= Metronome::kMaxSubdivision && start_frame >= 0;
}

}  // namespace

extern "C" {

kb_result kb_rig_click_start(
    kb_engine* engine,
    double bpm,
    int32_t subdivision,
    int64_t start_frame
) {
  if (engine == nullptr || !ValidRigClick(bpm, subdivision, start_frame)) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  kitbag::Engine* target = ToEngine(engine);
  if (target->metronome_intent() || target->metronome().is_running()) {
    return KB_ERROR_BUSY;
  }
  const bool had_intent = target->rig_click_intent();
  target->SetRigClickIntent(true);
  const bool queued = target->metronome().rig_click().Start(
      bpm,
      subdivision,
      static_cast<uint64_t>(start_frame)
  );
  if (queued) return KB_OK;
  target->SetRigClickIntent(had_intent);
  return KB_ERROR_BUSY;
}

void kb_rig_click_stop(kb_engine* engine) {
  if (engine != nullptr) {
    ToEngine(engine)->metronome().rig_click().Stop();
    ToEngine(engine)->SetRigClickIntent(false);
  }
}

int32_t kb_rig_click_is_active(const kb_engine* engine) {
  if (engine == nullptr) return 0;
  return ToEngine(engine)->metronome().rig_click().is_active() ? 1 : 0;
}

}  // extern "C"
