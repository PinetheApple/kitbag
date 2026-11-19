#ifndef KITBAG_METRONOME_CUSTOM_SOUND_LIMITS_H
#define KITBAG_METRONOME_CUSTOM_SOUND_LIMITS_H

#include <cstdint>

#include "kitbag_click_sound_api.h"

namespace kitbag {

static constexpr int kCustomSoundSlots = KB_CUSTOM_SOUND_SLOTS;
static constexpr int kMaxCustomSoundSeconds = KB_MAX_CUSTOM_SOUND_SECONDS;
static constexpr uint32_t kCustomSoundRate = 48000;

}  // namespace kitbag

#endif  // KITBAG_METRONOME_CUSTOM_SOUND_LIMITS_H
