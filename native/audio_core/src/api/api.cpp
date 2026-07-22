// Engine lifecycle and the tuner's C ABI surface. The metronome is in
// api_metronome.cpp, media in api_media.cpp, offline analysis in
// api_analysis.cpp.
#include "kitbag_api.h"

#include "api/api_engine.h"

namespace {
constexpr const char* kVersion = "0.1.0";
}  // namespace

using kitbag::ToEngine;

extern "C" {

const char* kb_version(void) {
  return kVersion;
}

kb_result kb_engine_create(kb_engine** out_engine) {
  if (out_engine == nullptr) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  auto* engine = new kitbag::Engine();
  if (!engine->Init()) {
    delete engine;
    *out_engine = nullptr;
    return KB_ERROR_DEVICE_INIT_FAILED;
  }
  *out_engine = reinterpret_cast<kb_engine*>(engine);
  return KB_OK;
}

void kb_engine_destroy(kb_engine* engine) {
  delete ToEngine(engine);
}

kb_result kb_engine_start(kb_engine* engine) {
  if (engine == nullptr) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  return ToEngine(engine)->Start() ? KB_OK : KB_ERROR_DEVICE_START_FAILED;
}

void kb_engine_stop(kb_engine* engine) {
  if (engine != nullptr) {
    ToEngine(engine)->Stop();
  }
}

uint32_t kb_engine_sample_rate(const kb_engine* engine) {
  return engine == nullptr ? 0 : ToEngine(engine)->sample_rate();
}

uint64_t kb_engine_frames_rendered(const kb_engine* engine) {
  return engine == nullptr ? 0 : ToEngine(engine)->frames_rendered();
}

#ifdef KITBAG_BUILD_TOOLS
void kb_engine_render(kb_engine* engine, float* out, uint32_t frame_count) {
  if (engine == nullptr || out == nullptr || frame_count == 0) return;
  // Refuse while the device callback is live: it is the sole renderer, and a
  // second thread in Render would race the non-atomic mixer/player/metronome
  // state. Relaxed atomic load — no alloc, lock or syscall.
  if (ToEngine(engine)->is_running()) return;
  ToEngine(engine)->RenderOffline(out, frame_count);
}
#endif  // KITBAG_BUILD_TOOLS

kb_result kb_tuner_start(kb_engine* engine) {
  if (engine == nullptr) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  return ToEngine(engine)->tuner().Start() ? KB_OK
                                           : KB_ERROR_DEVICE_INIT_FAILED;
}

void kb_tuner_stop(kb_engine* engine) {
  if (engine != nullptr) {
    ToEngine(engine)->tuner().Stop();
  }
}

void kb_tuner_set_a4(kb_engine* engine, double a4_hz) {
  if (engine != nullptr) {
    ToEngine(engine)->tuner().SetA4(a4_hz);
  }
}

void kb_tuner_set_band(kb_engine* engine, double low_hz, double high_hz) {
  if (engine != nullptr) {
    ToEngine(engine)->tuner().SetBand(low_hz, high_hz);
  }
}

uint64_t kb_tuner_snapshot(const kb_engine* engine) {
  return engine == nullptr
             ? kitbag::Tuner::PackSnapshot(kitbag::PitchAnalyzer::Reading{})
             : ToEngine(engine)->tuner().snapshot();
}

}  // extern "C"
