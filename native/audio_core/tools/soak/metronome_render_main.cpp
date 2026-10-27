#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <string>

#include "metronome/metronome_types.h"
#include "soak_metronome_render.h"
#include "wav_fixture.h"

namespace {

constexpr uint32_t kSampleRate = 48000;

// Outside click_soak's 0-5, so soak-analyze.sh's one exit range stays unambiguous.
enum class RenderExit : int { kWritten = 0, kUsage = 2, kWriteFailed = 8 };

bool ParsePositive(const char* text, double* out) {
  char* end = nullptr;
  *out = std::strtod(text, &end);
  return *end == '\0' && std::isfinite(*out) && *out > 0.0;
}

int Usage() {
  std::fprintf(
      stderr,
      "usage: metronome_render <out.wav> <bpm> <seconds>\n"
      "Renders kitbag::Metronome offline (4/4, default sound, %u Hz stereo\n"
      "float WAV) so click_soak can be checked against the engine's output.\n",
      kSampleRate
  );
  return static_cast<int>(RenderExit::kUsage);
}

}  // namespace

int main(int argc, char** argv) {
  constexpr int kArgCount = 4;
  double bpm = 0.0;
  double seconds = 0.0;
  if (argc != kArgCount || !ParsePositive(argv[2], &bpm) ||
      !ParsePositive(argv[3], &seconds) || bpm < kitbag::kMinBpm ||
      bpm > kitbag::kMaxBpm) {
    return Usage();
  }
  const std::vector<float> samples =
      click_soak::RenderMetronome(bpm, seconds, kSampleRate);
  if (!media_test::WriteFloatWav(
          argv[1],
          samples,
          click_soak::kRenderChannels,
          kSampleRate
      )) {
    std::fprintf(stderr, "metronome_render: cannot write %s\n", argv[1]);
    return static_cast<int>(RenderExit::kWriteFailed);
  }
  return static_cast<int>(RenderExit::kWritten);
}
