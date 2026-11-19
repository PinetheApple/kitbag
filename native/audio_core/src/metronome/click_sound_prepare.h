#ifndef KITBAG_METRONOME_CLICK_SOUND_PREPARE_H
#define KITBAG_METRONOME_CLICK_SOUND_PREPARE_H

#include "kitbag_api.h"

#include <cstdint>
#include <vector>

#include "media/audio_source.h"

namespace kitbag {

// -60 dBFS: the first and last samples at or above it bound the sound.
inline constexpr float kClickSoundOnsetLevel = 0.001F;
// The built-in voices are unit-peak waveforms scaled by each role's gain.
inline constexpr float kClickSoundPeak = 1.0F;
inline constexpr double kClickSoundTailFadeSeconds = 0.005;

// Offline. The contract is kb_click_sound_prepare's.
kb_result PrepareClickSound(const char* in_path, const char* out_path);
kb_result PrepareClickSoundFrom(SourceReader* source, const char* out_path);

// Offline. A prepared file as mono at `rate`, untrimmed and unscaled; refuses
// one longer than kMaxCustomSoundSeconds without reading past that.
kb_result
LoadClickSound(const char* path, uint32_t rate, std::vector<float>* out);

}  // namespace kitbag

#endif  // KITBAG_METRONOME_CLICK_SOUND_PREPARE_H
