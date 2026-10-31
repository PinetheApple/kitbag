#include <string>

#include "metronome/metronome_internal.h"
#include "metronome_test_audio.h"

namespace metronome_test {
namespace {

constexpr double kTickAccentHz = 1500.0;
constexpr double kTickBeatHz = 1000.0;
constexpr double kTickSubdivisionHz = 800.0;
constexpr double kTickPolyHz = 1225.0;

using kitbag::metronome_detail::kAccentAmplitude;
using kitbag::metronome_detail::kAccentedSubdivisionGain;
using kitbag::metronome_detail::kBeatAmplitude;

constexpr double kLevelRatioTolerance = 0.005;
constexpr double kOffBeatGainTolerance = 0.02;
// The crossing-span estimate errs ~0.1%; 1% leaves margin and still rejects 2%.
constexpr double kHzTolerance = 0.01;

constexpr double kDbPerAmplitudeDecade = 20.0;
constexpr double kFloorDb = -kTickFloorDecades * kDbPerAmplitudeDecade;
constexpr double kFloorDbTolerance = 2.0;
constexpr double kCyclesToFirstPeak = 0.25;
constexpr double kPitchSeconds = 0.03;
constexpr double kEarlyWindowSeconds = 0.005;
constexpr double kLateWindowSeconds = 0.025;

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

bool NearIs(double measured, double want, double tolerance, const char* what) {
  if (std::fabs(measured - want) <= tolerance) return true;
  std::fprintf(
      stderr,
      "  %s: want %.4f, measured %.4f\n",
      what,
      want,
      measured
  );
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
  const std::string label =
      std::string("tick: ") + name + " falls 80 dB by 35 ms at the shared rate";
  Check(
      NearIs(FloorDbAtDecayEnd(left, hz), kFloorDb, kFloorDbTolerance, name),
      label.c_str()
  );
}

// Each voice's first sine peak lands a quarter cycle in, after some decay.
double PlainToAccentPeakRatio() {
  const double gap =
      kCyclesToFirstPeak / kTickBeatHz - kCyclesToFirstPeak / kTickAccentHz;
  return kBeatAmplitude / kAccentAmplitude *
         std::exp(-kTickDecayPerSecond * gap);
}

void TestTickPitchAndLevel() {
  const auto accent = Preview(true);
  const auto plain = Preview(false);
  Check(HzIs(accent, 0, kTickAccentHz), "tick: accent is a 1500 Hz sine");
  Check(HzIs(plain, 0, kTickBeatHz), "tick: plain beat is a 1000 Hz sine");
  Check(
      NearIs(
          VoicePeak(plain, 0) / VoicePeak(accent, 0),
          PlainToAccentPeakRatio(),
          kLevelRatioTolerance,
          "plain/accent peak"
      ),
      "tick: plain beat peaks at kBeatAmplitude / kAccentAmplitude"
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
  Check(
      HzIs(left, accented_slot, kTickAccentHz) &&
          NearIs(
              VoicePeak(left, accented_slot) / VoicePeak(left, 0),
              kAccentedSubdivisionGain,
              kOffBeatGainTolerance,
              "accented off-beat / downbeat"
          ),
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

void TestTickIsTheDefault() {
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);
  metronome.SetTimeSignature(4, 4);
  metronome.Start();
  const auto left = RenderLeft(metronome, 2 * kBeatFrames);
  Check(
      HzIs(left, 0, kTickAccentHz),
      "tick: a fresh metronome's accented downbeat is the tick"
  );
  Check(
      HzIs(left, kBeatFrames, kTickBeatHz),
      "tick: a fresh metronome's normal beat is the tick"
  );
}

}  // namespace

void RunTickTests() {
  TestTickIsTheDefault();
  TestTickPitchAndLevel();
  TestTickEnvelope();
  TestTickSubdivisionVoices();
  TestTickPolyVoice();
}

}  // namespace metronome_test
