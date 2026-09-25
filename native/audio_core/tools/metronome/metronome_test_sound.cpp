#include "metronome_test_audio.h"

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

constexpr double kPreviewVolume = 0.5;
constexpr double kNormalPeak = 0.6;
constexpr double kVolumeTolerance = 0.02;

void TestPreviewPlaysOneClickWhileStopped() {
  kitbag::Metronome metronome;
  metronome.SetVolume(kPreviewVolume);
  metronome.PreviewSound(kTom, false);
  metronome.PreviewSound(kitbag::Metronome::kSoundCount, true);
  const auto left = RenderLeft(metronome, kBeatFrames, [&](int64_t at) {
    if (at == kBeatFrames / 2 / kBlockFrames * kBlockFrames) {
      metronome.PreviewSound(kHihat, true);
    }
  });
  const int64_t second = kBeatFrames / 2 / kBlockFrames * kBlockFrames;

  Check(
      PitchIs(left, 0, kTomBeatHz) && !metronome.is_running(),
      "preview: plays the normal voice of the sound while stopped"
  );
  Check(
      std::fabs(PeakIn(left, 0) - kNormalPeak * kPreviewVolume) <
          kVolumeTolerance,
      "preview: scaled by the current volume"
  );
  Check(
      PitchIs(left, second, kHihatAccentHz),
      "preview: the accent voice when accented, on the next block"
  );
}

void TestPreviewInvalidIdsIgnored() {
  kitbag::Metronome plain;
  StartFourFour(plain);
  const auto plain_left = RenderLeft(plain, kBarFrames);
  kitbag::Metronome previewed;
  previewed.PreviewSound(kitbag::Metronome::kSoundCount, false);
  previewed.PreviewSound(-1, true);
  StartFourFour(previewed);
  const auto left = RenderLeft(previewed, kBarFrames);
  Check(
      SameSamples(left, 0, plain_left, 0, kBarFrames),
      "preview: out-of-table ids add nothing to the output"
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
  TestPreviewPlaysOneClickWhileStopped();
  TestPreviewInvalidIdsIgnored();
}

}  // namespace metronome_test
