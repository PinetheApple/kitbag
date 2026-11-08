#include "kitbag_api.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <numbers>
#include <vector>

#include "analysis/beat_tracker.h"
#include "analyze_buffer_driver.h"
#include "analyze_test_support.h"
#include "check.h"

namespace analyze_test {
namespace {

using kitbag::BeatResult;
using kitbag_test::Check;

struct Tempo {
  const char* name;
  int period_frames;
  int pulses_per_beat;
};

// Non-round periods near the tracker's 60-200 BPM edges. At 63.7 BPM the
// off-beat hits make a 127.4 BPM pulse, which BestPeakLag folds onto.
constexpr std::array<Tempo, 3> kTempos = {{
    {"63.7 BPM", 41537, 2},
    {"132.5 BPM", kBeatPeriodFrames, 1},
    {"187.9 BPM", 14081, 1},
}};
constexpr int kSustainedBeats = 40;
constexpr int kBeatsPerChord = 4;
constexpr std::array<float, 4> kChordRootsHz =
    {110.0f, 146.83f, 164.81f, 92.5f};
constexpr std::array<float, 4> kChordRatios = {1.0f, 1.26f, 1.5f, 2.0f};
constexpr float kPadAmp = 0.06f;
constexpr float kKickAmp = 0.8f;
constexpr float kKickDecayPerSec = 30.0f;
constexpr float kKickBaseHz = 60.0f;
constexpr float kKickSweepHz = 80.0f;
constexpr float kKickSweepDecayPerSec = 40.0f;
constexpr float kOffbeatAmp = 0.25f;
constexpr float kOffbeatDecayPerSec = 200.0f;
constexpr uint32_t kNoiseSeed = 12345u;
constexpr uint32_t kLcgMul = 1664525u;
constexpr uint32_t kLcgInc = 1013904223u;
constexpr float kLcgScale = 1.0f / 2147483648.0f;
constexpr double kBpmTolerance = 0.03;
constexpr int kMissableBeats = 2;
constexpr double kMinGapPeriods = 0.75;
constexpr double kSecondsPerMinute = 60.0;
constexpr float kTwoPi = 2.0f * std::numbers::pi_v<float>;

float Kick(float t) {
  const float hz =
      kKickBaseHz + kKickSweepHz * std::exp(-t * kKickSweepDecayPerSec);
  return kKickAmp * std::exp(-t * kKickDecayPerSec) * std::sin(kTwoPi * hz * t);
}

float Noise(uint32_t& state) {
  state = state * kLcgMul + kLcgInc;
  return static_cast<float>(static_cast<int32_t>(state)) * kLcgScale;
}

float Pad(int beat, float song_t) {
  const float root =
      kChordRootsHz[(beat / kBeatsPerChord) % kChordRootsHz.size()];
  float v = 0.0f;
  for (const float ratio : kChordRatios) {
    v += std::sin(kTwoPi * root * ratio * song_t);
  }
  return kPadAmp * v;
}

// A pad sounding through every beat, a kick on the beat and a softer hit on
// the off-beat: onsets never fall to zero between beats, as in recordings.
std::vector<float> MakeSustainedTrack(int period) {
  const int total = kSustainedBeats * period;
  std::vector<float> pcm(static_cast<size_t>(total) * 2, 0.0f);
  uint32_t noise = kNoiseSeed;
  const float rate = static_cast<float>(kSampleRate);
  for (int f = 0; f < total; ++f) {
    const int beat = f / period;
    const float t = static_cast<float>(f % period) / rate;
    const float off_t = static_cast<float>((f + period / 2) % period) / rate;
    const float v =
        Pad(beat, static_cast<float>(f) / rate) + Kick(t) +
        kOffbeatAmp * std::exp(-off_t * kOffbeatDecayPerSec) * Noise(noise);
    pcm[static_cast<size_t>(f) * 2] = v;
    pcm[static_cast<size_t>(f) * 2 + 1] = v;
  }
  return pcm;
}

double MinGap(const std::vector<float>& beats) {
  double gap = INFINITY;
  for (size_t i = 1; i < beats.size(); ++i) {
    gap = std::min(gap, static_cast<double>(beats[i] - beats[i - 1]));
  }
  return gap;
}

BeatResult AnalyzeSustained(const Tempo& tempo) {
  const std::vector<float> pcm = MakeSustainedTrack(tempo.period_frames);
  const uint64_t frames = pcm.size() / 2;
  BeatResult r;
  AnalyzeDecodedPcm(
      pcm.data(),
      frames,
      StereoInfo(frames, 2),
      "x",
      nullptr,
      &r
  );
  return r;
}

void CheckOneBeatPerPeriod(const Tempo& tempo) {
  const BeatResult r = AnalyzeSustained(tempo);
  const double pulse_sec = static_cast<double>(tempo.period_frames) /
                           kSampleRate / tempo.pulses_per_beat;
  const double pulse_bpm = kSecondsPerMinute / pulse_sec;
  const int expected = kSustainedBeats * tempo.pulses_per_beat;
  const int beats = static_cast<int>(r.beat_times.size());
  const double min_gap = MinGap(r.beat_times);
  std::printf(
      "analyze_verify: sustained %s -> bpm %.2f, %d beats of %d, "
      "min gap %.3f s of %.3f s period\n",
      tempo.name,
      r.bpm,
      beats,
      expected,
      min_gap,
      pulse_sec
  );
  Check(
      std::fabs(r.bpm - pulse_bpm) < kBpmTolerance * pulse_bpm,
      "sustained: detected tempo matches the played pulse"
  );
  Check(
      std::abs(beats - expected) <= kMissableBeats,
      "sustained: one beat placed per pulse"
  );
  Check(
      min_gap >= kMinGapPeriods * pulse_sec,
      "sustained: no gap shorter than three quarters of a period"
  );
}

}  // namespace

void RunSustainedTests() {
  for (const Tempo& tempo : kTempos) CheckOneBeatPerPeriod(tempo);
}

}  // namespace analyze_test
