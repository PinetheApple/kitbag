// Speed and key rendered as heard (SPEC.md §7.6): 0.75x with one stem at -2.
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <limits>
#include <string>
#include <vector>

#include "mixdown_test_support.h"

namespace mixdown_test {
namespace {

constexpr float kRate = 0.75f;
constexpr int32_t kTonePitch = -2;
constexpr uint64_t kSongFrames = 120000;
// Off any block boundary, and far enough apart that the first burst's
// stretched tail is gone before the second.
constexpr uint64_t kBurstAt[] = {30011, 90017};
constexpr uint64_t kBurstFrames = 12000;
constexpr double kBurstHz = 1000.0;
constexpr float kBurstAmplitude = 0.5f;
constexpr double kToneHz = 440.0;
constexpr float kToneAmplitude = 0.1f;
constexpr float kOnsetThreshold = 0.3f;
// The mixer's measured onset error is under 60 frames; a lag left in the file
// would be thousands.
constexpr int64_t kOnsetTolerance = 128;
constexpr int64_t kLengthTolerance = 64;
// Only the tone sounds here: past the first stretched burst, before the second.
constexpr int64_t kPitchFrom = 72000;
constexpr int64_t kPitchTo = 112000;
constexpr double kSemitonesPerOctave = 12.0;
// One semitone off is ~23 Hz away.
constexpr double kPitchToleranceHz = 3.0;
constexpr int kTrackBursts = 0;
constexpr int kTrackTone = 1;
constexpr int64_t kNotFound = -1;
constexpr float kS16Max = std::numeric_limits<int16_t>::max();

std::vector<float> Bursts() {
  std::vector<float> pcm(kSongFrames, 0.0f);
  for (const uint64_t at : kBurstAt) {
    const std::vector<float> burst =
        Sine(kBurstFrames, kBurstHz, kBurstAmplitude);
    std::copy(burst.begin(), burst.end(), pcm.begin() + at);
  }
  return pcm;
}

std::vector<float> Left(const WavFile& wav) {
  std::vector<float> left;
  for (size_t i = 0; i < wav.samples.size(); i += kStereo) {
    left.push_back(static_cast<float>(wav.samples[i]) / kS16Max);
  }
  return left;
}

int64_t FirstAbove(const std::vector<float>& left, int64_t from) {
  for (auto i = static_cast<size_t>(from); i < left.size(); ++i) {
    if (std::fabs(left[i]) > kOnsetThreshold) return static_cast<int64_t>(i);
  }
  return kNotFound;
}

double
ZeroCrossingHz(const std::vector<float>& left, int64_t from, int64_t to) {
  int64_t first = kNotFound;
  int64_t last = kNotFound;
  int64_t rises = 0;
  for (int64_t i = from + 1; i < to && i < static_cast<int64_t>(left.size());
       ++i) {
    if (left[i - 1] >= 0.0f || left[i] < 0.0f) continue;
    if (first == kNotFound) first = i;
    last = i;
    ++rises;
  }
  if (rises < 2) return 0.0;
  return static_cast<double>(rises - 1) * kSampleRate /
         static_cast<double>(last - first);
}

void CheckNear(int64_t got, int64_t want, int64_t tolerance, const char* tag) {
  const bool ok = got != kNotFound && std::llabs(got - want) <= tolerance;
  Check(ok, tag);
  if (!ok) {
    std::fprintf(
        stderr,
        "  got %lld, want %lld\n",
        (long long)got,
        (long long)want
    );
  }
}

WavFile RenderStretched() {
  kb_engine* engine = OpenEngine();
  if (engine == nullptr) return {};
  const std::string bursts = WriteStem("bursts", Bursts(), kMono, kSampleRate);
  const std::string tone = WriteStem(
      "tone",
      Sine(kSongFrames, kToneHz, kToneAmplitude),
      kMono,
      kSampleRate
  );
  kb_mixer_load_track(engine, kTrackBursts, bursts.c_str());
  kb_mixer_load_track(engine, kTrackTone, tone.c_str());
  Check(kb_mixer_set_rate(engine, kRate) == KB_OK, "stretch: set rate");
  Check(
      kb_mixer_set_track_pitch(engine, kTrackTone, kTonePitch) == KB_OK,
      "stretch: set key"
  );
  const std::string path = TempPath("stretch", ".wav");
  Check(kb_mixdown_start(engine, path.c_str()) == KB_OK, "stretch: start");
  Check(WaitForMixdown(engine), "stretch: finishes");
  Check(
      kb_mixdown_current_state(engine) == KB_MIXDOWN_STATE_DONE,
      "stretch: DONE"
  );
  kb_engine_destroy(engine);
  return ReadWav(path);
}

void CheckOnsets(const std::vector<float>& left) {
  const auto second_from =
      static_cast<int64_t>((kBurstAt[0] + kBurstFrames) / kRate) +
      kOnsetTolerance;
  CheckNear(
      FirstAbove(left, 0),
      std::llround(kBurstAt[0] / kRate),
      kOnsetTolerance,
      "stretch: first onset at its song frame over the rate"
  );
  CheckNear(
      FirstAbove(left, second_from),
      std::llround(kBurstAt[1] / kRate),
      kOnsetTolerance,
      "stretch: second onset at its song frame over the rate"
  );
}

void CheckPitch(const std::vector<float>& left) {
  const double want_hz =
      kToneHz * std::pow(2.0, kTonePitch / kSemitonesPerOctave);
  const double got_hz = ZeroCrossingHz(left, kPitchFrom, kPitchTo);
  const bool near = std::fabs(got_hz - want_hz) <= kPitchToleranceHz;
  Check(near, "stretch: the keyed stem sounds two semitones down");
  if (!near) std::fprintf(stderr, "  %.2f Hz, want %.2f Hz\n", got_hz, want_hz);
}

}  // namespace

void RunStretchTests() {
  const WavFile wav = RenderStretched();
  CheckNear(
      static_cast<int64_t>(wav.frames()),
      static_cast<int64_t>(std::ceil(kSongFrames / kRate)),
      kLengthTolerance,
      "stretch: length is the song over the rate"
  );
  const std::vector<float> left = Left(wav);
  CheckOnsets(left);
  CheckPitch(left);
}

}  // namespace mixdown_test
