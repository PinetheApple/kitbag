#ifndef KITBAG_TOOLS_METRONOME_CLICK_SOUND_TEST_SUPPORT_H
#define KITBAG_TOOLS_METRONOME_CLICK_SOUND_TEST_SUPPORT_H

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <string>
#include <vector>

#include "check.h"
#include "heap_probe.h"
#include "media/file_audio_reader.h"
#include "metronome/click_sound_prepare.h"
#include "metronome/custom_sound_limits.h"
#include "wav_fixture.h"

namespace click_sound_test {

// Just under -60 dBFS: a trim that only drops exact zeros keeps all of it.
constexpr float kSubThreshold = 0.00099F;
constexpr float kSampleTolerance = 1e-6F;
constexpr float kJustAudible = 0.0011F;
constexpr auto kFadeFrames = static_cast<size_t>(
    kitbag::kClickSoundTailFadeSeconds * kitbag::kCustomSoundRate
);

using kitbag_test::HeapPeakGrowth;
using kitbag_test::LiveHeapBytes;
using kitbag_test::ResetHeapPeak;

void RunPrepareTests();
void RunRefusalTests();
void RunWriteTests();
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

inline std::vector<float>
ReadMono(const std::string& path, uint32_t* rate, uint32_t* channels) {
  kitbag::FileAudioReader reader;
  if (!reader.Open(path.c_str())) return {};
  *rate = reader.sample_rate();
  *channels = reader.channels();
  std::vector<float> pcm(reader.total_frames() * reader.channels());
  reader.ReadFrames(pcm.data(), reader.total_frames());
  return pcm;
}

// Regular files only: a device such as /dev/full never reaches end of file.
inline std::vector<uint8_t> FileBytes(const std::string& path) {
  if (!std::filesystem::is_regular_file(path)) return {};
  std::ifstream in(path, std::ios::binary);
  return {std::istreambuf_iterator<char>(in), std::istreambuf_iterator<char>()};
}

inline float Peak(const std::vector<float>& pcm) {
  float peak = 0.0F;
  for (float s : pcm) peak = std::max(peak, std::fabs(s));
  return peak;
}

inline int SignChanges(const std::vector<float>& pcm) {
  int changes = 0;
  float last = 0.0F;
  for (float s : pcm) {
    if (s == 0.0F) continue;
    if (last != 0.0F && (s > 0.0F) != (last > 0.0F)) ++changes;
    last = s;
  }
  return changes;
}

}  // namespace click_sound_test

#endif  // KITBAG_TOOLS_METRONOME_CLICK_SOUND_TEST_SUPPORT_H
