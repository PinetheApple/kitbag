#ifndef KITBAG_TOOLS_MIXER_MIXER_TEST_SUPPORT_H
#define KITBAG_TOOLS_MIXER_MIXER_TEST_SUPPORT_H

// Shared rig for the mixer_verify suite: ramp fixtures, offline rendering and
// the assertion helpers. One executable, several test files.
#include <atomic>
#include <cstdint>
#include <cstdio>
#include <filesystem>
#include <string>
#include <vector>

#include "check.h"
#include "mixer/mixer.h"
#include "wav_fixture.h"

namespace mixer_test {

using kitbag_test::Check;
using kitbag_test::g_checks;
using kitbag_test::g_failures;

constexpr uint32_t kSampleRate = 48000;
constexpr uint32_t kBlock = 512;
constexpr uint32_t kMono = 1;
constexpr uint32_t kStereo = 2;
constexpr uint64_t kShortFrames = 1000;
constexpr uint64_t kLongFrames = 5000;
// Keeps the two stems' samples apart by more than any frame index in play, so a
// mixed sample names the track it came from as well as its source frame.
constexpr float kLongOffset = 100000.0f;
constexpr float kEpsilon = 0.001f;

// pcm[i] = offset + i, so a mixed sample reveals exactly which source frame
// landed where — the only way to tell advancing from replaying.
inline std::vector<float> MakeRamp(uint64_t frames, float offset) {
  std::vector<float> pcm(frames);
  for (uint64_t i = 0; i < frames; ++i) {
    pcm[i] = offset + static_cast<float>(i);
  }
  return pcm;
}

// Temp WAVs written during the run. A streaming source reads them lazily, so a
// file must outlive the mixer; they persist until CleanupTempFiles at suite end
// rather than being deleted per-test.
inline std::vector<std::string>& TempFiles() {
  static std::vector<std::string> files;
  return files;
}

inline std::string NextTempPath() {
  static std::atomic<uint64_t> counter{0};
  const std::filesystem::path path =
      std::filesystem::temp_directory_path() /
      ("kitbag_mixer_" + std::to_string(counter.fetch_add(1)) + ".wav");
  return path.string();
}

// A fixture that could not be written or loaded fails the suite without
// inflating the check count — the real assertions downstream count themselves.
inline void FixtureFail(const char* message) {
  std::fprintf(stderr, "FIXTURE FAIL: %s\n", message);
  ++g_failures;
}

// Writes an interleaved ramp to a temp WAV and loads it through the real file
// path (kb_mixer_load_track's adapter). now_frame 0 / engine_running false: the
// suite drives Process by hand, so no callback is concurrent.
inline void LoadInterleaved(
    kitbag::Mixer* mixer,
    int track,
    uint64_t frames,
    uint32_t channels,
    float offset
) {
  const std::vector<float> pcm = MakeRamp(frames * channels, offset);
  const std::string path = NextTempPath();
  if (!media_test::WriteFloatWav(path, pcm, channels, kSampleRate)) {
    FixtureFail("could not write ramp WAV");
    return;
  }
  TempFiles().push_back(path);
  if (!mixer->LoadTrack(track, path.c_str(), 0, false)) {
    FixtureFail("could not load ramp WAV into the track");
  }
}

inline void
LoadRamp(kitbag::Mixer* mixer, int track, uint64_t frames, float offset) {
  LoadInterleaved(mixer, track, frames, kMono, offset);
}

inline void CleanupTempFiles() {
  std::error_code ec;
  for (const std::string& path : TempFiles()) {
    std::filesystem::remove(path, ec);
  }
  TempFiles().clear();
}

inline std::vector<float> RenderBlock(kitbag::Mixer* mixer) {
  std::vector<float> out(kBlock * 2, -1.0f);
  mixer->Process(out.data(), kBlock);
  return out;
}

// Asserts the buffer is long enough itself: a helper that iterates over the
// actual output passes vacuously when the output is empty.
inline void ExpectChannel(
    const std::vector<float>& out,
    uint32_t frame,
    uint32_t channel,
    float expected,
    const char* label
) {
  const size_t idx = static_cast<size_t>(frame) * 2 + channel;
  Check(out.size() > idx, label);
  if (out.size() <= idx) return;
  ++g_checks;
  if (out[idx] < expected - kEpsilon || out[idx] > expected + kEpsilon) {
    std::fprintf(
        stderr,
        "FAIL: %s — frame %u ch%u = %.3f, expected %.3f\n",
        label,
        frame,
        channel,
        static_cast<double>(out[idx]),
        static_cast<double>(expected)
    );
    ++g_failures;
  }
}

inline void ExpectSample(
    const std::vector<float>& out,
    uint32_t frame,
    float expected,
    const char* label
) {
  ExpectChannel(out, frame, 0, expected, label);
}

inline void
ExpectSilentBlock(const std::vector<float>& out, const char* label) {
  Check(out.size() == static_cast<size_t>(kBlock) * 2, label);
  if (out.size() != static_cast<size_t>(kBlock) * 2) return;
  for (size_t i = 0; i < out.size(); ++i) {
    if (out[i] != 0.0f) {
      std::fprintf(
          stderr,
          "FAIL: %s — sample %zu = %.3f, expected silence\n",
          label,
          i,
          static_cast<double>(out[i])
      );
      ++g_failures;
      return;
    }
  }
}

// Renders and discards a block so the command ring drains — transport and
// scalar commands are applied by Process, so state converges only across it.
inline void Drain(kitbag::Mixer* mixer) {
  RenderBlock(mixer);
}

void RunTransportTests();
void RunMixTests();
void RunSourceTests();
void RunResampleTests();
void RunPublishTests();

}  // namespace mixer_test

#endif  // KITBAG_TOOLS_MIXER_MIXER_TEST_SUPPORT_H
