#include <functional>

#include "custom_sound_fixture.h"
#include "metronome/metronome_internal.h"

namespace metronome_test {
namespace {

using kitbag::Accent;
using kitbag::Metronome;
using kitbag::metronome_detail::kAccentAmplitude;
using kitbag::metronome_detail::kBeatAmplitude;

using Setup = std::function<void(Metronome&)>;

constexpr size_t kHitFrames = 2000;
constexpr int64_t kBarFrames = 4 * kBeatFrames;
constexpr int64_t kPolyBeatFrames = kBarFrames / 3;
constexpr int64_t kOnsetSearch = 4;
constexpr int64_t kBuiltInPeakFrames = 200;
constexpr double kGainTolerance = 0.02;
constexpr float kShapeTolerance = 1e-6F;
constexpr int kCountInBars = 1;
constexpr int kAccentedSecondSlot = 0b10;
// Slow enough that the reference beep's beat has fallen silent by the half.
constexpr double kQuietTailBpm = 60.0;

std::vector<float> RenderWith(const Setup& setup, int normal, int accent) {
  Metronome metronome;
  Load(metronome, HitShape(kHitFrames));
  metronome.SetTempo(120.0);
  metronome.SetTimeSignature(4, 4);
  metronome.SetSounds(normal, accent);
  setup(metronome);
  metronome.Start();
  return RenderLeft(metronome, kBarFrames + kBeatFrames);
}

// The gain a hit was played at, or a negative value when the output at the
// onset is not the stored sound at one gain.
double PlayedGain(const std::vector<float>& left, int64_t onset) {
  const std::vector<float> shape = HitShape(kHitFrames);
  const double gain = left[static_cast<size_t>(onset)] / shape[0];
  for (size_t k = 0; k < kHitFrames; ++k) {
    const float want = shape[k] * static_cast<float>(gain);
    if (std::fabs(left[static_cast<size_t>(onset) + k] - want) >
        kShapeTolerance) {
      return -1.0;
    }
  }
  return gain;
}

void CheckRole(const char* label, const Setup& setup, int64_t at) {
  const auto custom = RenderWith(setup, kCustomSound, kCustomSound);
  const auto built_in = RenderWith(setup, kBeepSound, kBeepSound);
  const int64_t onset = FirstSoundFrom(custom, at - kOnsetSearch);
  const int64_t built_in_first = FirstSoundFrom(built_in, at - kOnsetSearch);
  const double gain = PlayedGain(custom, onset);
  const double peak =
      PeakOver(built_in, built_in_first, built_in_first + kBuiltInPeakFrames);
  const bool same_frame = onset == built_in_first - 1;
  const bool same_gain = std::fabs(gain - peak) <= kGainTolerance * peak;
  if (!same_frame || !same_gain) {
    std::fprintf(
        stderr,
        "  %s: onset %lld (built-in %lld), gain %.4f vs built-in peak %.4f\n",
        label,
        static_cast<long long>(onset),
        static_cast<long long>(built_in_first - 1),
        gain,
        peak
    );
  }
  Check(same_frame && same_gain, label);
}

void TestCustomHitLandsOnTheBeatFrame() {
  const auto left = RenderWith([](Metronome&) {}, kCustomSound, kCustomSound);
  Check(
      FirstSoundFrom(left, 0) == 0 &&
          FirstSoundFrom(left, kHitFrames) == kBeatFrames &&
          FirstSoundFrom(left, kBarFrames - kOnsetSearch) == kBarFrames,
      "custom: hits start exactly on frames 0, one beat and one bar"
  );
  Check(
      PlayedGain(left, 0) == static_cast<float>(kAccentAmplitude) &&
          PlayedGain(left, kBeatFrames) == static_cast<float>(kBeatAmplitude),
      "custom: the accent and a plain beat play the sound unchanged at their "
      "gains"
  );
}

void TestCustomGainsMatchBuiltIns() {
  const auto none = [](Metronome&) {};
  const auto halves = [](Metronome& m) {
    m.SetTempo(kQuietTailBpm);
    m.SetSubdivision(2);
  };
  const auto accented_halves = [](Metronome& m) {
    m.SetTempo(kQuietTailBpm);
    m.SetSubdivision(2);
    m.SetSubdivisionAccents(2, kAccentedSecondSlot);
  };
  const auto poly_only = [](Metronome& m) {
    for (int beat = 0; beat < 4; ++beat) m.SetAccent(beat, Accent::kMuted);
    m.SetPolyrhythm(true, 3);
  };
  CheckRole("custom gain: accent as a built-in", none, 0);
  CheckRole("custom gain: plain beat as a built-in", none, kBeatFrames);
  CheckRole("custom gain: subdivision as a built-in", halves, kBeatFrames);
  CheckRole(
      "custom gain: accented subdivision as a built-in",
      accented_halves,
      kBeatFrames
  );
  CheckRole("custom gain: poly accent as a built-in", poly_only, 0);
  CheckRole("custom gain: poly beat as a built-in", poly_only, kPolyBeatFrames);
}

void TestEmptySlotPlaysTick() {
  const auto busy = [](Metronome& m) {
    m.SetSubdivision(2);
    m.SetPolyrhythm(true, 3);
  };
  const auto empty = RenderWith(busy, kEmptySound, kEmptySound);
  const auto tick =
      RenderWith(busy, Metronome::kTickSound, Metronome::kTickSound);
  Check(
      SameSamples(empty, 0, tick, 0, kBarFrames),
      "custom: an empty slot plays tick in every role, beside a loaded slot"
  );
}

void TestCountInKeepsBuiltIns() {
  const auto count_in = [](Metronome& m) {
    m.SetCountIn(kCountInBars, false, 0);
  };
  const auto custom = RenderWith(count_in, kCustomSound, kCustomSound);
  const auto tick =
      RenderWith(count_in, Metronome::kTickSound, Metronome::kTickSound);
  Check(
      SameSamples(custom, 0, tick, 0, kBarFrames - kOnsetSearch),
      "count-in: a custom beat sound counts in with tick"
  );
  Check(
      PlayedGain(custom, kBarFrames) == static_cast<float>(kAccentAmplitude),
      "count-in: bar one after it plays the custom sound"
  );
}

void TestDistinctCountInRefusesCustom() {
  const auto refused = [](Metronome& m) {
    m.SetCountIn(kCountInBars, true, kCustomSound);
  };
  const auto plain = [](Metronome& m) {
    m.SetCountIn(kCountInBars, true, Metronome::kDefaultCountInSound);
  };
  const auto custom = RenderWith(refused, kBeepSound, kBeepSound);
  const auto reference = RenderWith(plain, kBeepSound, kBeepSound);
  Check(
      SameSamples(custom, 0, reference, 0, kBarFrames),
      "count-in: a custom id as the distinct sound keeps the previous one"
  );
}

void TestPreviewOfCustomSlot() {
  Metronome accented;
  Load(accented, HitShape(kHitFrames));
  accented.PreviewSound(kCustomSound, true);
  const auto accent_left = RenderLeft(accented, kBeatFrames);
  Metronome plain;
  Load(plain, HitShape(kHitFrames));
  plain.PreviewSound(kCustomSound, false);
  const auto plain_left = RenderLeft(plain, kBeatFrames);
  Check(
      PlayedGain(accent_left, 0) == static_cast<float>(kAccentAmplitude) &&
          PlayedGain(plain_left, 0) == static_cast<float>(kBeatAmplitude),
      "preview: a custom slot plays at the accent or the plain gain"
  );
  Metronome empty;
  empty.PreviewSound(kEmptySound, true);
  Metronome tick;
  tick.PreviewSound(Metronome::kTickSound, true);
  Check(
      SameSamples(
          RenderLeft(empty, kBeatFrames),
          0,
          RenderLeft(tick, kBeatFrames),
          0,
          kBeatFrames
      ),
      "preview: an empty slot previews tick"
  );
}

}  // namespace

void RunCustomSoundTests() {
  TestCustomHitLandsOnTheBeatFrame();
  TestCustomGainsMatchBuiltIns();
  TestEmptySlotPlaysTick();
  TestCountInKeepsBuiltIns();
  TestDistinctCountInRefusesCustom();
  TestPreviewOfCustomSlot();
}

}  // namespace metronome_test
