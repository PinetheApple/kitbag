#include <algorithm>
#include <cmath>
#include <numbers>
#include <string>
#include <vector>

#include "mixer_test_stretch_support.h"

namespace mixer_test {
namespace {

using LoadResult = kitbag::Mixer::LoadResult;

constexpr float kSpeed = 0.75f;
constexpr int64_t kStemFrames = int64_t{30} * kSampleRate;
constexpr int kSettleBlocks = 40;
constexpr int kFirstKeyedTrack = 1;
constexpr int kLastKeyedTrack = 4;
constexpr int kJoiningTrack = 0;
constexpr int kMovedTrack = 2;
constexpr float kFreeKey = 5.0f;
constexpr int64_t kBeatFrames = 23917;
constexpr int64_t kBurstHalfFrames = 1440;
constexpr double kPulseHz = 1000.0;
constexpr float kPulseAmplitude = 0.5f;
constexpr float kEnergyFloor = 1e-5f;
constexpr int kQuietFramesBetweenPulses = 2400;
constexpr int kMeasuredBlocks = 500;
// The stretch smears a pulse's centre by far less; the two configs differ by
// 6073 frames.
constexpr double kMaxSkewFrames = 240.0;

// Pulses on every second beat, starting at [first_beat], so two stems on
// different buses alternate and a misaligned bus shows in the spacing.
std::vector<float> PulsesEverySecondBeat(int first_beat) {
  std::vector<float> pcm(kStemFrames, 0.0f);
  for (int64_t centre = kBeatFrames * first_beat;
       centre + kBurstHalfFrames < kStemFrames;
       centre += 2 * kBeatFrames) {
    for (int64_t k = centre - kBurstHalfFrames; k < centre + kBurstHalfFrames;
         ++k) {
      const double into = static_cast<double>(k - centre + kBurstHalfFrames) /
                          (2.0 * kBurstHalfFrames);
      const double hann = 0.5 - 0.5 * std::cos(2.0 * std::numbers::pi * into);
      pcm[k] = kPulseAmplitude * static_cast<float>(hann) * SineAt(kPulseHz, k);
    }
  }
  return pcm;
}

std::string WriteStem(const std::vector<float>& pcm) {
  const std::string path = NextTempPath();
  if (!media_test::WriteFloatWav(path, pcm, kMono, kSampleRate)) {
    FixtureFail("could not write pulse WAV");
  }
  TempFiles().push_back(path);
  return path;
}

// Four distinct keys on tracks 1-4; only the last track's file is hidden later.
std::string PlayFourKeysWithPulsesOnTheFirst(kitbag::Mixer* mixer) {
  mixer->SetRate(kSpeed, kZeroClock, false);
  LoadPcm(mixer, kFirstKeyedTrack, PulsesEverySecondBeat(2));
  std::string last;
  for (int t = kFirstKeyedTrack + 1; t <= kLastKeyedTrack; ++t) {
    last = LoadSilence(mixer, t, kStemFrames);
  }
  for (int t = kFirstKeyedTrack; t <= kLastKeyedTrack; ++t) {
    mixer->SetTrackPitch(t, static_cast<float>(t), kZeroClock, false);
  }
  mixer->Play();
  RenderPaced(mixer, kSettleBlocks);
  return last;
}

std::vector<double> PulseCentres(const std::vector<float>& left) {
  std::vector<double> centres;
  double weight = 0.0;
  double moment = 0.0;
  int quiet = 0;
  for (size_t i = 0; i < left.size(); ++i) {
    const float energy = left[i] * left[i];
    if (energy > kEnergyFloor) {
      weight += energy;
      moment += energy * static_cast<double>(i);
      quiet = 0;
    } else if (weight > 0.0 && ++quiet > kQuietFramesBetweenPulses) {
      centres.push_back(moment / weight);
      weight = moment = 0.0;
      quiet = 0;
    }
  }
  return centres;
}

void CheckPulsesEvenlySpaced(
    const std::vector<float>& left,
    const char* label
) {
  const std::vector<double> centres = PulseCentres(left);
  const double want = static_cast<double>(kBeatFrames) / kSpeed;
  double worst = centres.size() < 4 ? want : 0.0;
  for (size_t c = 1; c < centres.size(); ++c) {
    worst = std::max(worst, std::fabs(centres[c] - centres[c - 1] - want));
  }
  Check(worst <= kMaxSkewFrames, label);
  if (worst > kMaxSkewFrames) {
    std::fprintf(
        stderr,
        "  %zu pulses, worst %.1f frames\n",
        centres.size(),
        worst
    );
  }
}

void CheckRefusedWithFileGone(
    kitbag::Mixer* mixer,
    const std::string& fragile,
    const std::string& joining
) {
  Hide(fragile);
  Check(
      mixer->LoadTrack(kJoiningTrack, joining.c_str(), kZeroClock, false) ==
          LoadResult::kPrimeFailed,
      "load refusal: a load whose prime fails is refused"
  );
  Check(
      !mixer->track_ready(kJoiningTrack),
      "load refusal: the refused stem is unloaded"
  );
  Check(
      !mixer->key_buses_vendor_default(),
      "load refusal: the refused stem leaves the config as it was"
  );
  Unhide(fragile);
}

void TestFailedPrimeRefusesTheStemAndKeepsTheConfig() {
  kitbag::Mixer mixer(kSampleRate);
  const std::string fragile = PlayFourKeysWithPulsesOnTheFirst(&mixer);
  const std::string joining = WriteStem(PulsesEverySecondBeat(1));
  CheckRefusedWithFileGone(&mixer, fragile, joining);
  RenderPaced(&mixer, 1);
  Check(
      mixer.SetTrackPitch(kMovedTrack, kFreeKey, kZeroClock, false) ==
              kitbag::Mixer::StretchResult::kOk &&
          !mixer.key_buses_vendor_default(),
      "load refusal: a later key stays on the live config"
  );
  Check(
      mixer.LoadTrack(kJoiningTrack, joining.c_str(), kZeroClock, false) ==
              kLoaded &&
          mixer.key_buses_vendor_default(),
      "load refusal: the stem loads and flips the config with the file back"
  );
  RenderPaced(&mixer, kSettleBlocks);
  CheckPulsesEvenlySpaced(
      RenderPaced(&mixer, kMeasuredBlocks),
      "load refusal: every bus shares one lag after the flip"
  );
}

void TestStoppedFailedPrimeRefusesTheStem() {
  kitbag::Mixer mixer(kSampleRate);
  mixer.SetRate(kSpeed, kZeroClock, false);
  const std::string fragile = LoadSilence(&mixer, 0, kStemFrames);
  const std::string second = WriteStem(PulsesEverySecondBeat(1));
  Hide(fragile);
  Check(
      mixer.LoadTrack(1, second.c_str(), kZeroClock, false) ==
              LoadResult::kPrimeFailed &&
          !mixer.track_ready(1),
      "load refusal: a stopped load whose prime fails is refused"
  );
  Unhide(fragile);
  Check(mixer.track_ready(0), "load refusal: the other stem stays loaded");
}

class SilentReader : public kitbag::SourceReader {
 public:
  uint32_t channels() const override {
    return kMono;
  }
  uint32_t sample_rate() const override {
    return kSampleRate;
  }
  uint64_t total_frames() const override {
    return kStemFrames;
  }
  kitbag::ReadResult ReadFrames(float* dst, uint64_t frames) override {
    std::fill_n(dst, frames, 0.0f);
    return {frames, kitbag::ReadStatus::kOk};
  }
  bool SeekToFrame(uint64_t) override {
    return true;
  }
};

void TestFailedPrimeRefusesASource() {
  SilentReader reader;
  kitbag::Mixer mixer(kSampleRate);
  mixer.SetRate(kSpeed, kZeroClock, false);
  const std::string fragile = LoadSilence(&mixer, 0, kStemFrames);
  Hide(fragile);
  Check(
      mixer.SetTrackSource(1, &reader, kZeroClock, false) ==
              LoadResult::kPrimeFailed &&
          !mixer.track_ready(1),
      "load refusal: a source whose prime fails is refused"
  );
  Unhide(fragile);
}

void TestUnopenableFileKeepsTheConfig() {
  kitbag::Mixer mixer(kSampleRate);
  PlayFourKeysWithPulsesOnTheFirst(&mixer);
  const std::string missing = NextTempPath();
  Check(
      mixer.LoadTrack(kJoiningTrack, missing.c_str(), kZeroClock, false) ==
              LoadResult::kInvalid &&
          !mixer.key_buses_vendor_default(),
      "load refusal: a file that will not open leaves the config as it was"
  );
}

}  // namespace

void RunLoadRefusalTests() {
  TestFailedPrimeRefusesTheStemAndKeepsTheConfig();
  TestStoppedFailedPrimeRefusesTheStem();
  TestFailedPrimeRefusesASource();
  TestUnopenableFileKeepsTheConfig();
}

}  // namespace mixer_test
