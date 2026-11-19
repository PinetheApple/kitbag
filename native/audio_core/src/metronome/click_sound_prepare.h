#ifndef KITBAG_METRONOME_CLICK_SOUND_PREPARE_H
#define KITBAG_METRONOME_CLICK_SOUND_PREPARE_H

#include "kitbag_api.h"

#include <cstdint>
#include <vector>

namespace kitbag {

// -60 dBFS: the first sample at or above it is where the sound starts.
inline constexpr float kClickSoundOnsetLevel = 0.001F;
// The built-in voices are unit-peak waveforms scaled by each role's gain.
inline constexpr float kClickSoundPeak = 1.0F;

// Offline. The contract is kb_click_sound_prepare's.
kb_result PrepareClickSound(const char* in_path, const char* out_path);

// Offline. A prepared file as mono at `rate`, untrimmed and unscaled; refuses
// one longer than kMaxCustomSoundSeconds without reading past that.
kb_result
LoadClickSound(const char* path, uint32_t rate, std::vector<float>* out);

}  // namespace kitbag

#endif  // KITBAG_METRONOME_CLICK_SOUND_PREPARE_H
