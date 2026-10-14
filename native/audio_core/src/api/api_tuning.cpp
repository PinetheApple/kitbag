// The tuner's string-aware tuning mode (kb_tuner_set_tuning and friends). The
// chromatic snapshot and mic lifecycle are in api.cpp.
#include "kitbag_api.h"

#include "api/api_engine.h"

using kitbag::ToEngine;

extern "C" {

kb_result kb_tuner_set_tuning(
    kb_engine* engine,
    int32_t instrument,
    const int32_t* string_midis,
    int32_t count
) {
  if (engine == nullptr) return KB_ERROR_INVALID_ARGUMENT;
  return ToEngine(engine)->tuner().SetTuning(instrument, string_midis, count);
}

kb_result kb_tuner_set_target_string(kb_engine* engine, int32_t string_index) {
  if (engine == nullptr) return KB_ERROR_INVALID_ARGUMENT;
  return ToEngine(engine)->tuner().SetTargetString(string_index);
}

kb_result kb_tuner_set_chromatic(kb_engine* engine) {
  if (engine == nullptr) return KB_ERROR_INVALID_ARGUMENT;
  return ToEngine(engine)->tuner().SetChromatic();
}

kb_result kb_tuner_reset_note_presence(kb_engine* engine, double pause_ms) {
  if (engine == nullptr) return KB_ERROR_INVALID_ARGUMENT;
  return ToEngine(engine)->tuner().ResetNotePresence(pause_ms);
}

void kb_tuner_read_state(const kb_engine* engine, kb_tuner_state* out) {
  if (out == nullptr) return;
  *out = engine == nullptr ? kitbag::TuningMode::RestState()
                           : ToEngine(engine)->tuner().tuning_state();
}

#ifdef KITBAG_BUILD_TOOLS
kb_result kb_tuner_offline_init(kb_engine* engine, uint32_t sample_rate) {
  if (engine == nullptr) return KB_ERROR_INVALID_ARGUMENT;
  return ToEngine(engine)->tuner().OfflineInit(sample_rate)
             ? KB_OK
             : KB_ERROR_INVALID_ARGUMENT;
}

void kb_tuner_offline_process(
    kb_engine* engine,
    const float* samples,
    uint32_t frame_count
) {
  if (engine == nullptr || samples == nullptr) return;
  ToEngine(engine)->tuner().OfflineProcess(samples, frame_count);
}
#endif  // KITBAG_BUILD_TOOLS

}  // extern "C"
