#ifndef KITBAG_MEDIA_DOWNMIX_H
#define KITBAG_MEDIA_DOWNMIX_H

#include <cstddef>
#include <cstdint>

namespace kitbag {

inline void DownmixToMono(
    const float* interleaved,
    size_t frames,
    uint32_t channels,
    float* mono
) {
  for (size_t f = 0; f < frames; ++f) {
    float sum = 0.0f;
    for (uint32_t ch = 0; ch < channels; ++ch) {
      sum += interleaved[f * channels + ch];
    }
    mono[f] = sum / static_cast<float>(channels);
  }
}

}  // namespace kitbag

#endif  // KITBAG_MEDIA_DOWNMIX_H
