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

kb_result kb_engine_hold(kb_engine* engine) {
  if (engine == nullptr) return KB_ERROR_INVALID_ARGUMENT;
  return ToEngine(engine)->Hold() ? KB_OK : KB_ERROR_DEVICE_START_FAILED;
}

void kb_engine_release(kb_engine* engine) {
  if (engine != nullptr) ToEngine(engine)->Release();
}

void kb_engine_reset_holders(kb_engine* engine) {
  if (engine != nullptr) ToEngine(engine)->ResetHolders();
}

uint32_t kb_engine_sample_rate(const kb_engine* engine) {
  return engine == nullptr ? 0 : ToEngine(engine)->sample_rate();
}

uint64_t kb_engine_frames_rendered(const kb_engine* engine) {
  return engine == nullptr ? 0 : ToEngine(engine)->frames_rendered();
}

kb_result kb_engine_clock_pair(
    const kb_engine* engine,
    int64_t* out_frame,
    int64_t* out_monotonic_ns
) {
  if (engine == nullptr || out_frame == nullptr ||
      out_monotonic_ns == nullptr) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  kitbag::ClockPair pair{};
  if (!ToEngine(engine)->ReadRenderClock(&pair)) return KB_ERROR_BUSY;
  *out_frame = pair.frame;
  *out_monotonic_ns = pair.monotonic_ns;
  return KB_OK;
}

int32_t kb_engine_output_device_id(const kb_engine* engine) {
  return engine == nullptr ? KB_NO_OUTPUT_DEVICE_ID
                           : ToEngine(engine)->OutputDeviceId();
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

void kb_engine_reserve_render_frames(kb_engine* engine, uint32_t frames) {
  if (engine != nullptr) ToEngine(engine)->ReserveCallbackFrames(frames);
}

int32_t kb_engine_holders(const kb_engine* engine) {
  return engine == nullptr ? 0 : ToEngine(engine)->holders();
}

int32_t kb_engine_device_running(const kb_engine* engine) {
  return engine != nullptr && ToEngine(engine)->is_running() ? 1 : 0;
}

int32_t kb_engine_idle(const kb_engine* engine) {
  return engine != nullptr && ToEngine(engine)->idle() ? 1 : 0;
}

void kb_engine_set_idle_grace_ms(kb_engine* engine, uint32_t grace_ms) {
  if (engine != nullptr) ToEngine(engine)->set_idle_grace_ms(grace_ms);
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

kb_result kb_tuner_set_a4(kb_engine* engine, double a4_hz) {
  if (engine == nullptr) return KB_ERROR_INVALID_ARGUMENT;
  return ToEngine(engine)->tuner().SetA4(a4_hz);
}

kb_result kb_tuner_set_band(kb_engine* engine, double low_hz, double high_hz) {
  if (engine == nullptr) return KB_ERROR_INVALID_ARGUMENT;
  return ToEngine(engine)->tuner().SetBand(low_hz, high_hz);
}

uint64_t kb_tuner_snapshot(const kb_engine* engine) {
  return engine == nullptr
             ? kitbag::Tuner::PackSnapshot(kitbag::TuningMode::RestState(), 0.0)
             : ToEngine(engine)->tuner().snapshot();
}

}  // extern "C"
