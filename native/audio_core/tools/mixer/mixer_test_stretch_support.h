#ifndef KITBAG_TOOLS_MIXER_MIXER_TEST_STRETCH_SUPPORT_H
#define KITBAG_TOOLS_MIXER_MIXER_TEST_STRETCH_SUPPORT_H

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <numbers>
#include <string>
#include <thread>
#include <vector>

#include "mixer_test_support.h"
#include "stretch/time_stretch.h"

namespace mixer_test {

constexpr float kBurstAmplitude = 0.5f;
constexpr float kOnsetThreshold = 0.25f;
constexpr double kBurstHz = 440.0;
constexpr double kBedHz = 170.0;
constexpr float kBedAmplitude = 0.03f;
constexpr int64_t kBurstFrames = kSampleRate / 4;
// Measured worst 57 frames across 0.5-1.0x and +-6 st; a wrong lag is >= 512.
constexpr int64_t kOnsetToleranceFrames = 128;
constexpr uint64_t kPaceFrames = 12288;
constexpr auto kPaceTimeout = std::chrono::milliseconds(10);
constexpr auto kPacePoll = std::chrono::microseconds(200);
constexpr int64_t kNotFound = -1;
constexpr double kMsPerSecond = 1000.0;

struct ToneSpec {
  int64_t frames = 0;
  int64_t burst_at = kNotFound;
  int64_t burst_frames = kBurstFrames;
  bool bed = false;
  double steady_hz = 0.0;
  float steady_amplitude = kBurstAmplitude;
};

inline float SineAt(double hz, int64_t frame) {
  return static_cast<float>(
      std::sin(2.0 * std::numbers::pi * hz * frame / kSampleRate)
  );
}

inline std::vector<float> ToneFixture(const ToneSpec& spec) {
  std::vector<float> pcm(spec.frames, 0.0f);
  for (int64_t i = 0; i < spec.frames; ++i) {
    float v = spec.bed ? kBedAmplitude * SineAt(kBedHz, i) : 0.0f;
    if (spec.steady_hz > 0.0) {
      v += spec.steady_amplitude * SineAt(spec.steady_hz, i);
    }
    const int64_t into = i - spec.burst_at;
    if (spec.burst_at != kNotFound && into >= 0 && into < spec.burst_frames) {
      v += kBurstAmplitude * SineAt(kBurstHz, into);
    }
    pcm[i] = v;
  }
  return pcm;
}

inline void
LoadPcm(kitbag::Mixer* mixer, int track, const std::vector<float>& pcm) {
  const std::string path = NextTempPath();
  if (!media_test::WriteFloatWav(path, pcm, kMono, kSampleRate)) {
    FixtureFail("could not write tone WAV");
    return;
  }
  TempFiles().push_back(path);
  if (!mixer->LoadTrack(track, path.c_str(), 0, false)) {
    FixtureFail("could not load tone WAV into the track");
  }
}

inline void LoadTone(kitbag::Mixer* mixer, int64_t frames) {
  LoadPcm(mixer, 0, ToneFixture({.frames = frames, .steady_hz = kBurstHz}));
}

inline std::string
LoadSilence(kitbag::Mixer* mixer, int track, int64_t frames) {
  LoadPcm(mixer, track, ToneFixture({.frames = frames}));
  return TempFiles().back();
}

inline void WaitForReadAhead(const kitbag::Mixer& mixer) {
  const auto deadline = std::chrono::steady_clock::now() + kPaceTimeout;
  for (int t = 0; t < mixer.active_track_count(); ++t) {
    while (mixer.track_buffered(t) < kPaceFrames && !mixer.track_at_end(t) &&
           std::chrono::steady_clock::now() < deadline) {
      std::this_thread::sleep_for(kPacePoll);
    }
  }
}

inline void AppendLeft(
    std::vector<float>* left,
    const std::vector<float>& out,
    uint32_t frames
) {
  for (uint32_t f = 0; f < frames; ++f) left->push_back(out[2 * f]);
}

inline std::vector<float>
RenderPaced(kitbag::Mixer* mixer, int blocks, uint32_t frames = kBlock) {
  std::vector<float> left;
  std::vector<float> out(static_cast<size_t>(frames) * 2);
  for (int b = 0; b < blocks; ++b) {
    WaitForReadAhead(*mixer);
    mixer->Process(out.data(), frames);
    AppendLeft(&left, out, frames);
  }
  return left;
}

inline int64_t
FirstAbove(const std::vector<float>& left, float threshold, int64_t from = 0) {
  for (auto i = static_cast<size_t>(std::max<int64_t>(from, 0));
       i < left.size();
       ++i) {
    if (std::fabs(left[i]) > threshold) return static_cast<int64_t>(i);
  }
  return kNotFound;
}

inline float Loudest(const std::vector<float>& left, int64_t from, int64_t to) {
  float peak = 0.0f;
  const auto end = std::min<int64_t>(to, static_cast<int64_t>(left.size()));
  for (int64_t i = std::max<int64_t>(from, 0); i < end; ++i) {
    peak = std::max(peak, std::fabs(left[i]));
  }
  return peak;
}

// A click is broadband: its second difference is about its step size, while a
// tone's stays near amplitude * (2 pi f / sr)^2.
inline float
PeakCurvature(const std::vector<float>& left, int64_t from, int64_t to) {
  float peak = 0.0f;
  const auto end = std::min<int64_t>(to, static_cast<int64_t>(left.size()));
  for (int64_t i = std::max<int64_t>(from, 2); i < end; ++i) {
    peak =
        std::max(peak, std::fabs(left[i] - 2.0f * left[i - 1] + left[i - 2]));
  }
  return peak;
}

inline int64_t LagFrames(double rate) {
  kitbag::TimeStretch stretch;
  stretch.Configure(kStereo, kSampleRate);
  return stretch.SongLagFrames(rate);
}

inline int64_t VendorDefaultLagFrames(double rate) {
  kitbag::TimeStretch stretch;
  stretch.ConfigureVendorDefault(kStereo, kSampleRate);
  return stretch.SongLagFrames(rate);
}

inline int64_t OutputFramesFor(int64_t song_frames, double rate) {
  return std::llround(static_cast<double>(song_frames) / rate);
}

inline double Ms(int64_t frames) {
  return kMsPerSecond * static_cast<double>(frames) / kSampleRate;
}

inline void
CheckNear(int64_t got, int64_t expected, int64_t tolerance, const char* label) {
  const bool ok = got != kNotFound && std::llabs(got - expected) <= tolerance;
  Check(ok, label);
  if (!ok) {
    std::fprintf(
        stderr,
        "  got %lld, expected %lld +- %lld\n",
        static_cast<long long>(got),
        static_cast<long long>(expected),
        static_cast<long long>(tolerance)
    );
  }
}

struct LoopProbe {
  int64_t start = 0;
  int64_t end = 0;
  int64_t from = 0;
};

// The existing click budget: the bypass loop wrap's equal-power crossfade.
inline float LoopWrapCurvature(
    const std::vector<std::vector<float>>& stems,
    const LoopProbe& probe
) {
  kitbag::Mixer mixer(kSampleRate);
  for (size_t t = 0; t < stems.size(); ++t) {
    LoadPcm(&mixer, static_cast<int>(t), stems[t]);
  }
  mixer.SetLoop(probe.start, probe.end, 0, false);
  mixer.Seek(probe.from, 0, false);
  mixer.Play();
  const int64_t wrap = probe.end - probe.from;
  const int blocks = static_cast<int>(2 * wrap / kBlock) + 1;
  const std::vector<float> left = RenderPaced(&mixer, blocks);
  const int64_t margin = mixer.crossfade_frames();
  return PeakCurvature(left, wrap - margin, wrap + 2 * margin);
}

struct ClockedRender {
  std::vector<float> left;
  std::vector<int64_t> song;
};

inline void AppendClock(const kitbag::Mixer& mixer, ClockedRender* run) {
  const kitbag::SongClock& clock = mixer.song_clock();
  for (uint32_t i = 0; i < kBlock; ++i) {
    run->song.push_back(i < clock.frames ? clock.SongFrameAt(i) : kNotFound);
  }
}

inline void ClockedBlock(kitbag::Mixer* mixer, ClockedRender* run) {
  const std::vector<float> block = RenderPaced(mixer, 1);
  run->left.insert(run->left.end(), block.begin(), block.end());
  AppendClock(*mixer, run);
}

// The song frame the mixer's clock reports where the first onset sounds.
inline int64_t SongFrameAtOnset(kitbag::Mixer* mixer, int blocks) {
  ClockedRender run;
  for (int b = 0; b < blocks; ++b) ClockedBlock(mixer, &run);
  const int64_t onset = FirstAbove(run.left, kOnsetThreshold);
  return onset == kNotFound ? kNotFound : run.song[onset];
}

// The start of the first whole block-long window from [from] whose peak stays
// at or under [threshold], or kNotFound.
inline int64_t FirstQuietWindow(
    const std::vector<float>& left,
    int64_t from,
    float threshold
) {
  const auto size = static_cast<int64_t>(left.size());
  for (int64_t at = from; at + kBlock <= size; at += kBlock) {
    if (Loudest(left, at, at + kBlock) <= threshold) return at;
  }
  return kNotFound;
}

inline void CheckNoQuietWindow(
    const std::vector<float>& left,
    int64_t from,
    const char* label
) {
  const int64_t quiet = FirstQuietWindow(left, from, kOnsetThreshold);
  Check(quiet == kNotFound, label);
  if (quiet != kNotFound) {
    std::fprintf(
        stderr,
        "  quiet window at frame %lld\n",
        static_cast<long long>(quiet)
    );
  }
}

inline void CheckSoundsAtOnce(kitbag::Mixer* mixer, const char* label) {
  const std::vector<float> first = RenderPaced(mixer, 1);
  const float peak = Loudest(first, mixer->crossfade_frames(), kBlock);
  Check(peak > kOnsetThreshold, label);
  if (peak <= kOnsetThreshold) {
    std::fprintf(
        stderr,
        "  first-block peak %.3f\n",
        static_cast<double>(peak)
    );
  }
}

// Blocks until a mid-play engage has handed over, with a block to spare.
inline int HandOverBlocks(const kitbag::Mixer& mixer) {
  return static_cast<int>(mixer.handover_lead_frames() / kBlock) + 2;
}

size_t ThreadAllocations();

void RunStretchTests();
void RunKeyBusTests();
void RunConfigTests();
void RunSwitchTests();
void RunPrimeTests();
void RunRaceTests();
void RunLandingTests();
void RunRefusalTests();
void RunRePrimeTests();
void RunRetireTests();

}  // namespace mixer_test

#endif  // KITBAG_TOOLS_MIXER_MIXER_TEST_STRETCH_SUPPORT_H
