#include <array>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <numbers>
#include <random>
#include <vector>

#include "input_stepper.h"
#include "stretch/time_stretch.h"

namespace {

constexpr int kSampleRate = 48000;
constexpr int kChannels = 2;
constexpr int kBlockFrames = 512;
constexpr int kSeconds = 30;
constexpr int kAudioFrames = kSeconds * kSampleRate;
constexpr int kInputFrames = kAudioFrames + kBlockFrames;
constexpr int kMaxInstances = 7;
constexpr int kInstanceCounts[] = {1, 2, 4, 6, 7};
constexpr double kRates[] = {0.5, 0.75, 1.0};
constexpr float kShiftSemitones = 3.0f;
constexpr double kToneHz = 196.0;
constexpr int kPartials = 6;
constexpr float kToneAmplitude = 0.3f;
constexpr float kNoiseAmplitude = 0.1f;
constexpr double kMsPerSecond = 1000.0;
// Mirror the vendor's presetDefault and presetCheaper at kSampleRate.
constexpr double kDefaultBlockSeconds = 0.12;
constexpr double kDefaultIntervalSeconds = 0.03;
constexpr double kCheaperBlockSeconds = 0.1;
constexpr double kCheaperIntervalSeconds = 0.04;
constexpr int kAltBlockFrames = 7680;
constexpr int kAltIntervalFrames = 960;

struct NamedConfig {
  const char* name;
  kitbag::StretchConfig config;
};

int Frames(double seconds) {
  return static_cast<int>(seconds * kSampleRate);
}

std::array<NamedConfig, 4> Configs() {
  const int chosen = Frames(kitbag::TimeStretch::kBlockSeconds);
  return {{
      {"presetDefault",
       {Frames(kDefaultBlockSeconds), Frames(kDefaultIntervalSeconds), false}},
      {"presetCheaper",
       {Frames(kCheaperBlockSeconds), Frames(kCheaperIntervalSeconds), true}},
      {"chosen 0.2s/6x",
       {chosen,
        chosen / kitbag::TimeStretch::kOverlap,
        kitbag::TimeStretch::kSplitComputation}},
      {"7680/960", {kAltBlockFrames, kAltIntervalFrames, true}},
  }};
}

std::vector<float> NoisyHarmonicTone() {
  std::vector<float> out(static_cast<std::size_t>(kInputFrames) * kChannels);
  std::minstd_rand engine(1);
  std::uniform_real_distribution<float> noise(
      -kNoiseAmplitude,
      kNoiseAmplitude
  );
  const double step = 2.0 * std::numbers::pi * kToneHz / kSampleRate;
  for (int i = 0; i < kInputFrames; ++i) {
    double tone = 0.0;
    for (int h = 1; h <= kPartials; ++h) tone += std::sin(step * i * h) / h;
    for (int c = 0; c < kChannels; ++c) {
      out[i * kChannels + c] =
          kToneAmplitude * static_cast<float>(tone) + noise(engine);
    }
  }
  return out;
}

double SecondsToRender(
    std::array<kitbag::TimeStretch, kMaxInstances>& instances,
    int count,
    const std::vector<float>& in,
    double rate
) {
  std::vector<float> out(kBlockFrames * kChannels);
  stretch_test::InputStepper stepper(rate, kBlockFrames);
  int pos = 0;
  const auto start = std::chrono::steady_clock::now();
  for (int done = 0; done < kAudioFrames; done += kBlockFrames) {
    const int take = stepper.Next();
    for (int i = 0; i < count; ++i) {
      instances[i]
          .Process(&in[pos * kChannels], take, out.data(), kBlockFrames);
    }
    pos += take;
  }
  const std::chrono::duration<double> elapsed =
      std::chrono::steady_clock::now() - start;
  return elapsed.count();
}

void BenchRow(
    const NamedConfig& named,
    int count,
    double rate,
    const std::vector<float>& in
) {
  std::array<kitbag::TimeStretch, kMaxInstances> instances;
  for (int i = 0; i < count; ++i) {
    instances[i].Configure(kChannels, named.config);
    instances[i].SetTransposeSemitones(
        i % 2 == 0 ? kShiftSemitones : -kShiftSemitones
    );
  }
  const double seconds = SecondsToRender(instances, count, in, rate);
  std::printf(
      "%-16s %2d %5.2f %10.2f %9.4f\n",
      named.name,
      count,
      rate,
      kMsPerSecond * seconds / kSeconds,
      seconds / kSeconds
  );
  std::fflush(stdout);
}

}  // namespace

int main() {
  const std::vector<float> in = NoisyHarmonicTone();
  std::printf(
      "stretch_bench: %d s stereo at %d Hz, %d-frame blocks, +-%.0f st\n",
      kSeconds,
      kSampleRate,
      kBlockFrames,
      kShiftSemitones
  );
  std::printf("%-16s %2s %5s %10s %9s\n", "config", "N", "rate", "ms/s", "rt");
  for (const NamedConfig& named : Configs()) {
    for (int count : kInstanceCounts) {
      for (double rate : kRates) BenchRow(named, count, rate, in);
    }
  }
  return 0;
}
