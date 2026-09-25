#include "metronome_test_support.h"

namespace metronome_test {
namespace {

using kitbag::Accent;

constexpr int kWoodblock = 1;
constexpr int kClick = 2;
constexpr int kTom = 3;
constexpr int kHihat = 4;
constexpr int kCowbell = 5;

constexpr int64_t kBeatFrames = kSampleRate / 2;
constexpr int64_t kBarFrames = 4 * kBeatFrames;
constexpr int64_t kHalfBeatFrames = kBeatFrames / 2;
constexpr int64_t kPitchWindow = 2400;
constexpr double kPitchTolerance = 0.05;
constexpr double kSilentCeiling = 0.01;

constexpr double kBeepAccentHz = 1760.0;
constexpr double kBeepBeatHz = 1174.7;
constexpr double kWoodblockBeatHz = 1800.0;
constexpr double kClickAccentHz = 3600.0;
constexpr double kTomBeatHz = 450.0;
constexpr double kTomSubdivisionHz = 300.0;
constexpr double kTomPolyHz = 520.0;
constexpr double kHihatAccentHz = 5000.0;
constexpr double kHihatPolyHz = 4500.0;
constexpr double kCowbellAccentHz = 2200.0;

template <typename OnBlock>
std::vector<float> RenderLeft(
    kitbag::Metronome& metronome,
    int64_t total_frames,
    OnBlock on_block
) {
  std::vector<float> left;
  std::vector<float> buffer(static_cast<size_t>(kBlockFrames) * kChannels);
  for (int64_t rendered = 0; rendered < total_frames;
       rendered += kBlockFrames) {
    on_block(rendered);
    std::fill(buffer.begin(), buffer.end(), 0.0f);
    metronome.Render(
        buffer.data(),
        kBlockFrames,
        kSampleRate,
        kChannels,
        static_cast<uint64_t>(rendered)
    );
    for (uint32_t frame = 0; frame < kBlockFrames; ++frame) {
      left.push_back(buffer[static_cast<size_t>(frame) * kChannels]);
    }
  }
  return left;
}

std::vector<float> RenderLeft(kitbag::Metronome& metronome, int64_t frames) {
  return RenderLeft(metronome, frames, [](int64_t) {});
}

double PitchAt(const std::vector<float>& left, int64_t onset) {
  int crossings = 0;
  for (int64_t i = onset + 1; i < onset + kPitchWindow; ++i) {
    const auto at = static_cast<size_t>(i);
    if ((left[at - 1] < 0.0f) != (left[at] < 0.0f)) ++crossings;
  }
  return crossings / 2.0 * kSampleRate / static_cast<double>(kPitchWindow);
}

bool PitchIs(const std::vector<float>& left, int64_t onset, double hz) {
  return std::fabs(PitchAt(left, onset) - hz) <= hz * kPitchTolerance;
}

double PeakIn(const std::vector<float>& left, int64_t onset) {
  double peak = 0.0;
  for (int64_t i = onset; i < onset + kPitchWindow; ++i) {
    peak = std::max(
        peak,
        std::fabs(static_cast<double>(left[static_cast<size_t>(i)]))
    );
  }
  return peak;
}

void StartFourFour(kitbag::Metronome& metronome) {
  metronome.SetTempo(120.0);
  metronome.SetTimeSignature(4, 4);
  metronome.Start();
}

void TestDefaultSoundsUnchanged() {
  kitbag::Metronome metronome;
  StartFourFour(metronome);
  const auto left = RenderLeft(metronome, kBarFrames);

  Check(PitchIs(left, 0, kBeepAccentHz), "sounds: default accent is beep");
  Check(
      PitchIs(left, kBeatFrames, kBeepBeatHz),
      "sounds: default normal beat is beep"
  );
}

void TestNormalAndAccentSoundsIndependent() {
  kitbag::Metronome metronome;
  metronome.SetSounds(kTom, kHihat);
  metronome.SetSubdivision(2);
  StartFourFour(metronome);
  const auto left = RenderLeft(metronome, kBarFrames);

  Check(
      PitchIs(left, 0, kHihatAccentHz),
      "sounds: accented downbeat plays the accent sound (hihat)"
  );
  Check(
      PitchIs(left, kBeatFrames, kTomBeatHz),
      "sounds: normal beat plays the normal sound (tom)"
  );
  Check(
      PitchIs(left, kHalfBeatFrames, kTomSubdivisionHz),
      "sounds: subdivision of the accented beat plays the normal sound"
  );
}

void TestInvalidSoundIdsKeepPrior() {
  kitbag::Metronome metronome;
  metronome.SetSounds(kTom, kHihat);
  metronome.SetSounds(-1, kitbag::Metronome::kSoundCount);
  StartFourFour(metronome);
  const auto left = RenderLeft(metronome, kBarFrames, [&](int64_t at) {
    if (at == (kBeatFrames / kBlockFrames + 1) * kBlockFrames) {
      metronome.SetSounds(kitbag::Metronome::kSoundCount, kCowbell);
    }
  });

  Check(
      PitchIs(left, 0, kHihatAccentHz) &&
          PitchIs(left, kBeatFrames, kTomBeatHz),
      "sounds: out-of-table ids keep both previous sounds"
  );
  Check(
      PitchIs(left, 2 * kBeatFrames, kTomBeatHz),
      "sounds: an invalid normal id beside a valid accent id keeps the normal"
  );
  const auto next = RenderLeft(metronome, kBarFrames);
  Check(
      PitchIs(next, 0, kCowbellAccentHz),
      "sounds: the valid accent id in a mixed call still applies"
  );
}

void TestSoundsApplyLiveWhileRunning() {
  kitbag::Metronome metronome;
  metronome.SetSounds(kTom, kHihat);
  StartFourFour(metronome);
  const auto left = RenderLeft(metronome, 2 * kBarFrames, [&](int64_t at) {
    if (at == kBarFrames - kBlockFrames) {
      metronome.SetSounds(kWoodblock, kClick);
    }
  });

  Check(
      PitchIs(left, 2 * kBeatFrames, kTomBeatHz),
      "sounds live: bar 0 normal beats keep the old sound"
  );
  Check(
      PitchIs(left, kBarFrames, kClickAccentHz) &&
          PitchIs(left, kBarFrames + kBeatFrames, kWoodblockBeatHz),
      "sounds live: the next bar plays the new accent and normal sounds"
  );
}

void TestMutedBeatsAndSubdivisionsSilent() {
  kitbag::Metronome metronome;
  metronome.SetSounds(kTom, kHihat);
  metronome.SetSubdivision(2);
  metronome.SetAccent(0, Accent::kMuted);
  metronome.SetAccent(1, Accent::kMuted);
  StartFourFour(metronome);
  const auto left = RenderLeft(metronome, kBarFrames);

  Check(
      PeakIn(left, 0) < kSilentCeiling &&
          PeakIn(left, kHalfBeatFrames) < kSilentCeiling,
      "sounds: a muted accented beat and its subdivision stay silent"
  );
  Check(
      PeakIn(left, kBeatFrames) < kSilentCeiling &&
          PeakIn(left, kBeatFrames + kHalfBeatFrames) < kSilentCeiling,
      "sounds: a muted normal beat and its subdivision stay silent"
  );
  Check(
      PitchIs(left, 2 * kBeatFrames + kHalfBeatFrames, kTomSubdivisionHz),
      "sounds: an unmuted beat's subdivision still sounds"
  );
}

void TestPolyFollowsItsAccentSound() {
  kitbag::Metronome metronome;
  metronome.SetSounds(kTom, kHihat);
  for (int beat = 0; beat < 4; ++beat) {
    metronome.SetAccent(beat, Accent::kMuted);
  }
  metronome.SetPolyrhythm(true, 3);
  StartFourFour(metronome);
  const auto left = RenderLeft(metronome, kBarFrames);

  Check(
      PitchIs(left, 0, kHihatPolyHz),
      "sounds: accented poly beat plays the accent sound's poly voice"
  );
  Check(
      PitchIs(left, kBarFrames / 3, kTomPolyHz),
      "sounds: normal poly beat plays the normal sound's poly voice"
  );
}

}  // namespace

void RunSoundTests() {
  TestDefaultSoundsUnchanged();
  TestNormalAndAccentSoundsIndependent();
  TestInvalidSoundIdsKeepPrior();
  TestSoundsApplyLiveWhileRunning();
  TestMutedBeatsAndSubdivisionsSilent();
  TestPolyFollowsItsAccentSound();
}

}  // namespace metronome_test
