#include <utility>
#include <vector>

#include "api/api_engine.h"
#include "kitbag_click_sound_api.h"
#include "metronome/click_sound_prepare.h"

using kitbag::ToEngine;

static_assert(
    kitbag::kCustomSoundSlots == 2,
    "kb_metronome_*_custom_sound docs say slot 0 or 1"
);

extern "C" {

kb_result kb_click_sound_prepare(const char* in_path, const char* out_path) {
  return kitbag::PrepareClickSound(in_path, out_path);
}

kb_result kb_metronome_load_custom_sound(
    kb_engine* engine,
    int32_t slot,
    const char* path
) {
  if (engine == nullptr || !kitbag::SampleVoices::IsValidSlot(slot)) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  kitbag::Engine* core = ToEngine(engine);
  std::vector<float> frames;
  const kb_result loaded =
      kitbag::LoadClickSound(path, core->sample_rate(), &frames);
  if (loaded != KB_OK) return loaded;
  core->custom_sounds().Publish(
      slot,
      std::move(frames),
      core->frames_rendered(),
      core->is_running()
  );
  return KB_OK;
}

void kb_metronome_clear_custom_sound(kb_engine* engine, int32_t slot) {
  if (engine == nullptr) return;
  kitbag::Engine* core = ToEngine(engine);
  core->custom_sounds()
      .Clear(slot, core->frames_rendered(), core->is_running());
}

int32_t
kb_metronome_custom_sound_loaded(const kb_engine* engine, int32_t slot) {
  return engine != nullptr && ToEngine(engine)->custom_sounds().loaded(slot)
             ? 1
             : 0;
}

}  // extern "C"
