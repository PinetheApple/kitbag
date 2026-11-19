#include "kitbag_api.h"

#include "api/api_engine.h"

using kitbag::MixdownJob;
using kitbag::ToEngine;

namespace {

using State = MixdownJob::State;
static_assert(static_cast<int32_t>(State::kIdle) == KB_MIXDOWN_STATE_IDLE);
static_assert(
    static_cast<int32_t>(State::kRunning) == KB_MIXDOWN_STATE_RUNNING
);
static_assert(static_cast<int32_t>(State::kDone) == KB_MIXDOWN_STATE_DONE);
static_assert(static_cast<int32_t>(State::kFailed) == KB_MIXDOWN_STATE_FAILED);
static_assert(
    static_cast<int32_t>(State::kCancelled) == KB_MIXDOWN_STATE_CANCELLED
);

kb_result ToKbResult(MixdownJob::StartResult result) {
  switch (result) {
    case MixdownJob::StartResult::kOk:
      return KB_OK;
    case MixdownJob::StartResult::kBusy:
      return KB_ERROR_BUSY;
    case MixdownJob::StartResult::kInvalid:
      return KB_ERROR_INVALID_ARGUMENT;
    case MixdownJob::StartResult::kNoSpace:
      return KB_ERROR_NO_SPACE;
    case MixdownJob::StartResult::kTooLong:
      return KB_ERROR_TOO_LONG;
  }
  return KB_ERROR_INTERNAL;
}

}  // namespace

extern "C" {

kb_result kb_mixdown_start(kb_engine* engine, const char* out_path) {
  if (engine == nullptr || out_path == nullptr) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  kitbag::Engine* e = ToEngine(engine);
  return ToKbResult(e->mixdown().Start(e->mixer().Snapshot(), out_path));
}

void kb_mixdown_cancel(kb_engine* engine) {
  if (engine != nullptr) ToEngine(engine)->mixdown().Cancel();
}

double kb_mixdown_progress(const kb_engine* engine) {
  return engine == nullptr ? 0.0 : ToEngine(engine)->mixdown().progress();
}

int32_t kb_mixdown_current_state(const kb_engine* engine) {
  if (engine == nullptr) return KB_MIXDOWN_STATE_IDLE;
  return static_cast<int32_t>(ToEngine(engine)->mixdown().state());
}

}  // extern "C"
