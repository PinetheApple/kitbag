#ifndef KITBAG_TOOLS_SOAK_SOAK_METRONOME_RENDER_H
#define KITBAG_TOOLS_SOAK_SOAK_METRONOME_RENDER_H

#include <algorithm>
#include <cstdint>
#include <vector>

#include "metronome/metronome.h"

namespace click_soak {

constexpr uint32_t kRenderBlockFrames = 256;
constexpr uint32_t kRenderChannels = 2;

// One click per beat: subdivisions or polyrhythm would read as doubles.
inline std::vector<float>
RenderMetronome(double bpm, double seconds, uint32_t sample_rate) {
  kitbag::Metronome metronome;
  metronome.SetTempo(bpm);
  metronome.SetTimeSignature(4, 4);
  metronome.Start();
  const auto total = static_cast<uint64_t>(seconds * sample_rate);
  std::vector<float> block(kRenderBlockFrames * kRenderChannels);
  std::vector<float> rendered;
  for (uint64_t frame = 0; frame < total; frame += kRenderBlockFrames) {
    std::fill(block.begin(), block.end(), 0.0F);
    metronome.Render(
        block.data(),
        kRenderBlockFrames,
        sample_rate,
        kRenderChannels,
        frame
    );
    rendered.insert(rendered.end(), block.begin(), block.end());
  }
  return rendered;
}

}  // namespace click_soak

#endif  // KITBAG_TOOLS_SOAK_SOAK_METRONOME_RENDER_H
