#include <string>

#include "metronome_test_audio.h"

namespace metronome_test {
namespace {

constexpr double kTickAccentHz = 1500.0;
constexpr double kTickBeatHz = 1000.0;
constexpr double kTickSubdivisionHz = 800.0;
constexpr double kTickPolyHz = 1225.0;

constexpr double kReferencePlainToAccent = 0.7;
constexpr double kLevelRatioTolerance = 0.05;
constexpr double kAccentedOffBeatGain = 0.75;
constexpr double kOffBeatGainTolerance = 0.02;
// The interpolated crossing-span estimate of a clean sine is within 0.1%.
constexpr double kHzTolerance = 0.01;

constexpr double kFloorDb = -80.0;
constexpr double kFloorDbTolerance = 2.0;
constexpr double kCyclesToFirstPeak = 0.25;
constexpr double kPitchSeconds = 0.03;
constexpr double kEarlyWindowSeconds = 0.005;
constexpr double kLateWindowSeconds = 0.025;
constexpr double kDbPerAmplitudeDecade = 20.0;

constexpr int kSubdivision = 4;
constexpr int kAccentedSlot = 2;
constexpr int kPolyBeats = 3;
constexpr int64_t kSubdivisionFrames = kBeatFrames / kSubdivision;
constexpr int64_t kBarFrames = 4 * kBeatFrames;

double CrossingAt(const std::vector<float>& left, int64_t i) {
  const double a = left[static_cast<size_t>(i - 1)];
  const double b = left[static_cast<size_t>(i)];
  return static_cast<double>(i - 1) + a / (a - b);
}

double CrossingHz(const std::vector<float>& left, int64_t onset) {
  double first = -1.0;
  double last = -1.0;
  int crossings = 0;
  for (int64_t i = onset + 1; i < onset + FramesFor(kPitchSeconds); ++i) {
    const auto at = static_cast<size_t>(i);
    if ((left[at - 1] < 0.0f) == (left[at] < 0.0f)) continue;
    last = CrossingAt(left, i);
    if (crossings++ == 0) first = last;
  }
  if (crossings < 2) return 0.0;
  return (crossings - 1) / 2.0 * kSampleRate / (last - first);
}

bool HzIs(const std::vector<float>& left, int64_t onset, double hz) {
  const double measured = CrossingHz(left, onset);
  if (std::fabs(measured - hz) <= hz * kHzTolerance) return true;
  std::fprintf(stderr, "  want %.1f Hz, measured %.1f Hz\n", hz, measured);
  return false;
}

double VoicePeak(const std::vector<float>& left, int64_t onset) {
  return PeakOver(left, onset, onset + FramesFor(kTickDecaySeconds));
}

std::vector<float> Preview(bool accented) {
  kitbag::Metronome metronome;
  metronome.PreviewSound(kTickSound, accented);
  return RenderLeft(metronome, kBeatFrames);
}

double CyclePeakAt(const std::vector<float>& left, double seconds, double hz) {
  const int64_t from = FramesFor(seconds);
  return PeakOver(left, from, from + FramesFor(1.0 / hz));
}

double FloorDbAtDecayEnd(const std::vector<float>& left, double hz) {
  const double early = CyclePeakAt(left, kEarlyWindowSeconds, hz);
  const double late = CyclePeakAt(left, kLateWindowSeconds, hz);
  const double db_per_second = kDbPerAmplitudeDecade *
                               std::log10(late / early) /
                               (kLateWindowSeconds - kEarlyWindowSeconds);
  return db_per_second * kTickDecaySeconds;
}

void CheckEnvelope(
    const std::vector<float>& left,
    double hz,
    const char* name
) {
  const double floor_db = FloorDbAtDecayEnd(left, hz);
  if (std::fabs(floor_db - kFloorDb) > kFloorDbTolerance) {
    std::fprintf(stderr, "  %s: %.1f dB under peak at 35 ms\n", name, floor_db);
  }
  Check(
      std::fabs(floor_db - kFloorDb) <= kFloorDbTolerance,
      (std::string("tick: ") + name + " decays to -80 dB at 35 ms").c_str()
  );
}

void TestTickPitchAndLevel() {
  const auto accent = Preview(true);
  const auto plain = Preview(false);
  Check(HzIs(accent, 0, kTickAccentHz), "tick: accent is a 1500 Hz sine");
  Check(HzIs(plain, 0, kTickBeatHz), "tick: plain beat is a 1000 Hz sine");
  const double ratio = VoicePeak(plain, 0) / VoicePeak(accent, 0);
  if (std::fabs(ratio - kReferencePlainToAccent) > kLevelRatioTolerance) {
    std::fprintf(stderr, "  plain/accent peak ratio %.3f\n", ratio);
  }
  Check(
      std::fabs(ratio - kReferencePlainToAccent) <= kLevelRatioTolerance,
      "tick: plain beat peaks at ~0.7 of the accent"
  );
}

void TestTickEnvelope() {
  const auto accent = Preview(true);
  const double peak = VoicePeak(accent, 0);
  const int64_t first_peak = FramesFor(kCyclesToFirstPeak / kTickAccentHz);
  const double onset = PeakOver(accent, 0, first_peak + 1);
  if (onset < peak) {
    std::fprintf(
        stderr,
        "  first quarter cycle %.4f, peak %.4f\n",
        onset,
        peak
    );
  }
  Check(
      onset >= peak,
      "tick: no attack, the first quarter cycle carries the peak"
  );
  CheckEnvelope(accent, kTickAccentHz, "accent");
  CheckEnvelope(Preview(false), kTickBeatHz, "plain beat");
}

void TestTickSubdivisionVoices() {
  kitbag::Metronome metronome;
  metronome.SetSounds(kTickSound, kTickSound);
  metronome.SetTempo(120.0);
  metronome.SetTimeSignature(4, 4);
  metronome.SetSubdivision(kSubdivision);
  metronome.SetSubdivisionAccents(kSubdivision, int32_t{1} << kAccentedSlot);
  metronome.Start();
  const auto left = RenderLeft(metronome, kBeatFrames);
  const int64_t accented_slot = kAccentedSlot * kSubdivisionFrames;
  Check(
      HzIs(left, kSubdivisionFrames, kTickSubdivisionHz),
      "tick: a plain subdivision is an 800 Hz sine"
  );
  const double gain = VoicePeak(left, accented_slot) / VoicePeak(left, 0);
  if (std::fabs(gain - kAccentedOffBeatGain) > kOffBeatGainTolerance) {
    std::fprintf(stderr, "  accented off-beat / downbeat %.3f\n", gain);
  }
  Check(
      HzIs(left, accented_slot, kTickAccentHz) &&
          std::fabs(gain - kAccentedOffBeatGain) <= kOffBeatGainTolerance,
      "tick: an accented off-beat is the accent pitch at the off-beat gain"
  );
}

void TestTickPolyVoice() {
  kitbag::Metronome metronome;
  metronome.SetSounds(kTickSound, kTickSound);
  metronome.SetTempo(120.0);
  metronome.SetTimeSignature(4, 4);
  metronome.SetPolyrhythm(true, kPolyBeats);
  metronome.Start();
  const auto left = RenderLeft(metronome, kBarFrames);
  Check(
      HzIs(left, kBarFrames / kPolyBeats, kTickPolyHz),
      "tick: a poly beat is a 1225 Hz sine"
  );
}

}  // namespace

void RunTickTests() {
  TestTickPitchAndLevel();
  TestTickEnvelope();
  TestTickSubdivisionVoices();
  TestTickPolyVoice();
}

}  // namespace metronome_test
