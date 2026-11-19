#ifndef KITBAG_TOOLS_METRONOME_CLICK_SOUND_TEST_SUPPORT_H
#define KITBAG_TOOLS_METRONOME_CLICK_SOUND_TEST_SUPPORT_H

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

#include "check.h"
#include "wav_fixture.h"

namespace click_sound_test {

// Just under -60 dBFS: a trim that only drops exact zeros keeps all of it.
constexpr float kSubThreshold = 0.00099F;
constexpr float kSampleTolerance = 1e-6F;
constexpr float kJustAudible = 0.0011F;

void ResetHeapPeak();
size_t HeapPeakGrowth();
size_t LiveHeapBytes();

void RunPrepareTests();
void RunRefusalTests();
void RunLoadTests();
void RunVoiceTests();
void RunRaceTests();

// Alternating sign, so a trim keyed on a signed level keeps it too.
inline std::vector<float> SubThresholdLead(size_t frames) {
  std::vector<float> lead(frames);
  for (size_t i = 0; i < frames; ++i) {
    lead[i] = i % 2 == 0 ? kSubThreshold : -kSubThreshold;
  }
  return lead;
}

// Starts and ends just over the threshold and peaks at `peak`, so neither the onset nor
// the scale can be read off a round number.
inline std::vector<float> Body(size_t frames, float peak) {
  std::vector<float> body(frames);
  float largest = 0.0F;
  for (size_t i = 0; i < frames; ++i) {
    const double t = static_cast<double>(i);
    body[i] = static_cast<float>(
        std::sin(0.0173 * t + 0.0011) * std::exp(-t / 9000.0)
    );
    largest = std::max(largest, std::fabs(body[i]));
  }
  for (float& sample : body) sample *= peak / largest;
  body.front() = kJustAudible;
  body.back() = -kJustAudible;
  return body;
}

inline std::vector<float>
Concat(std::vector<float> a, const std::vector<float>& b) {
  a.insert(a.end(), b.begin(), b.end());
  return a;
}

inline std::string Fixture(
    const std::string& name,
    const std::vector<float>& pcm,
    uint32_t channels,
    uint32_t rate
) {
  const std::string path = media_test::UniqueTempPath(name);
  return media_test::WriteFloatWav(path, pcm, channels, rate) ? path : "";
}

inline std::string OutPath(const std::string& name) {
  return media_test::UniqueTempPath(name);
}

}  // namespace click_sound_test

#endif  // KITBAG_TOOLS_METRONOME_CLICK_SOUND_TEST_SUPPORT_H
