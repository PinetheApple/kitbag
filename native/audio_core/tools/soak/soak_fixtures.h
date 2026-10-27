#ifndef KITBAG_TOOLS_SOAK_SOAK_FIXTURES_H
#define KITBAG_TOOLS_SOAK_SOAK_FIXTURES_H

#include <unistd.h>

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <filesystem>
#include <string>
#include <vector>

#include "check.h"
#include "click_classifier.h"
#include "metronome/metronome_internal.h"
#include "onset_detector.h"

namespace soak_test {

using kitbag_test::Check;

constexpr uint32_t kRate = 48000;
constexpr uint32_t kFileRate = 44100;
// Off-round on purpose: a 512.82 ms beat and a first beat that is no multiple
// of it, so a grid built from the wrong origin or interval cannot line up.
constexpr double kBpm = 117.0;
constexpr double kFirstBeatSec = 0.2371;
constexpr size_t kBeats = 40;
constexpr double kOneSampleMs = 1000.0 / kRate;
// Sample rounding of each click puts one interval up to a sample off.
constexpr double kTightMs = 1.5 * kOneSampleMs;

inline double Interval() {
  return 60.0 / kBpm;
}

inline std::vector<double> GridTimes(size_t beats = kBeats) {
  std::vector<double> times;
  for (size_t i = 0; i < beats; ++i) {
    times.push_back(kFirstBeatSec + static_cast<double>(i) * Interval());
  }
  return times;
}

// Ends before beat kBeats's slot, so no beat past the train is judged.
inline double FixtureSeconds() {
  return kFirstBeatSec + kBeats * Interval();
}

inline void AddClick(
    std::vector<float>* mono,
    double time_sec,
    double amplitude,
    uint32_t rate
) {
  const auto start = static_cast<size_t>(std::llround(time_sec * rate));
  for (size_t n = 0; start + n < mono->size(); ++n) {
    const double t = static_cast<double>(n) / rate;
    const double envelope = amplitude * std::exp(-40.0 * t);
    if (envelope < 1e-4) break;
    (*mono)[start + n] +=
        static_cast<float>(envelope * std::sin(2.0 * M_PI * 1500.0 * t));
  }
}

// Every fourth click accented, as the engine plays a 4/4 bar.
inline std::vector<float>
Synthesize(const std::vector<double>& clicks, double gain, uint32_t rate) {
  const double seconds = std::max(FixtureSeconds(), clicks.back() + Interval());
  std::vector<float> mono(static_cast<size_t>(seconds * rate), 0.0F);
  for (size_t i = 0; i < clicks.size(); ++i) {
    const double level = i % 4 == 0 ? kitbag::metronome_detail::kAccentAmplitude
                                    : kitbag::metronome_detail::kBeatAmplitude;
    AddClick(&mono, clicks[i], level * gain, rate);
  }
  return mono;
}

inline void AddNoise(std::vector<float>* mono, double amplitude) {
  uint32_t state = 0x2545F491U;
  for (float& sample : *mono) {
    state = (state * 1664525U) + 1013904223U;
    const double unit = static_cast<double>(state) / 4294967296.0;
    sample += static_cast<float>(amplitude * ((2.0 * unit) - 1.0));
  }
}

inline click_soak::Report Classify(
    const std::vector<float>& mono,
    const std::vector<double>& grid,
    uint32_t rate = kRate
) {
  click_soak::DetectionLevels levels;
  const std::vector<double> onsets =
      click_soak::DetectOnsets(mono, rate, Interval(), &levels);
  const double seconds = static_cast<double>(mono.size()) / rate;
  return click_soak::ClassifyClicks(onsets, grid, seconds);
}

inline bool Near(double actual, double expected, double tolerance) {
  return std::fabs(actual - expected) <= tolerance;
}

inline std::string TempPath(const std::string& name) {
  return (std::filesystem::temp_directory_path() /
          ("click_soak_verify_" + std::to_string(getpid()) + "_" + name))
      .string();
}

void RunClassifyTests();
void RunRobustnessTests();
void RunTimingTests();
void RunRecordingEndTests();
void RunCliTests();
void RunMetronomeTests();

}  // namespace soak_test

#endif  // KITBAG_TOOLS_SOAK_SOAK_FIXTURES_H
