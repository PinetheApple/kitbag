#include "kitbag_api.h"

#include "engine.h"

namespace {
constexpr const char* kVersion = "0.1.0";

kitbag::Engine* ToEngine(kb_engine* engine) {
  return reinterpret_cast<kitbag::Engine*>(engine);
}

const kitbag::Engine* ToEngine(const kb_engine* engine) {
  return reinterpret_cast<const kitbag::Engine*>(engine);
}
}  // namespace

extern "C" {

const char* kb_version(void) { return kVersion; }

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

void kb_engine_destroy(kb_engine* engine) { delete ToEngine(engine); }

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

void kb_engine_set_test_tone(kb_engine* engine, int32_t enabled,
                             float frequency_hz) {
  if (engine != nullptr) {
    ToEngine(engine)->SetTestTone(enabled != 0, frequency_hz);
  }
}

}  // extern "C"
