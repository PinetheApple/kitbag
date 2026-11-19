#ifndef KITBAG_TOOLS_MIXDOWN_MIXDOWN_TEST_SUPPORT_H
#define KITBAG_TOOLS_MIXDOWN_MIXDOWN_TEST_SUPPORT_H

#include "kitbag_api.h"

#include <chrono>
#include <cstdint>
#include <string>
#include <vector>

#include "check.h"
#include "mixdown/mixdown_job.h"

namespace mixdown_test {

using kitbag_test::Check;
using kitbag_test::g_checks;
using kitbag_test::g_failures;

constexpr uint32_t kSampleRate = 48000;
constexpr uint32_t kStemRate44k = 44100;
constexpr uint32_t kMono = 1;
constexpr uint32_t kStereo = 2;
constexpr uint32_t kLiveBlock = 512;
constexpr auto kMixdownTimeout = std::chrono::seconds(60);
constexpr auto kPoll = std::chrono::milliseconds(1);
// Offline pulls outrun the read-ahead thread; 2 ms a block is still ~5x
// realtime and leaves the ring full under a concurrent render.
constexpr auto kLivePace = std::chrono::milliseconds(2);
constexpr float kAudiblePeak = 0.1f;

struct WavFile {
  bool parsed = false;
  uint32_t riff_bytes = 0;
  uint32_t data_bytes = 0;
  uint16_t format = 0;
  uint16_t channels = 0;
  uint32_t sample_rate = 0;
  uint16_t bits = 0;
  uint64_t file_bytes = 0;
  std::vector<int16_t> samples;

  uint64_t frames() const {
    return samples.size() / kStereo;
  }
};

WavFile ReadWav(const std::string& path);
// From the header alone; 0 unless its data size matches the file's.
uint64_t WavFrames(const std::string& path);
bool Exists(const std::string& path);
std::string TempPath(const std::string& name, const char* extension);
void RemoveLater(const std::string& path);
void RemoveTempFiles();

std::vector<float> Noise(uint64_t frames, uint32_t channels, uint32_t seed);
std::vector<float> Sine(uint64_t frames, double hz, float amplitude);
std::string WriteStem(
    const std::string& name,
    const std::vector<float>& pcm,
    uint32_t channels,
    uint32_t rate
);

kb_engine* OpenEngine();
bool WaitForMixdown(kb_engine* engine);
bool WaitForJob(const kitbag::MixdownJob& job);
int16_t ExpectedS16(float sample);
std::vector<int16_t> RenderLive(kb_engine* engine, uint64_t frames);
float PeakOf(const std::vector<int16_t>& samples);
// Samples that differ, plus the length difference.
uint64_t
Mismatches(const std::vector<int16_t>& got, const std::vector<int16_t>& want);

size_t LiveHeapBytes();
size_t PeakHeapBytes();
void ResetPeakHeap();

void RunExactTests();
void RunStretchTests();
void RunLifecycleTests();
void RunMemoryTests();

}  // namespace mixdown_test

#endif  // KITBAG_TOOLS_MIXDOWN_MIXDOWN_TEST_SUPPORT_H
