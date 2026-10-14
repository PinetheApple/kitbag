// Detection and accuracy: the right string, the right cents, the right Hz.
#include "tuning_mode_test_support.h"

namespace tuning_test {
namespace {

void T1() {
  BeginGuitar();
  Log log;
  const bool ok = SettlesOn(&log, 1.0, GuitarHz(kStringE2), kStringE2, 0.0);
  Expect(ok, log, "T1 E2 82.41Hz -> string 0, |err| <= 1c by 600ms");
}

void T2() {
  for (int32_t string = 0; string < 6; ++string) {
    BeginGuitar();
    Log log;
    const bool ok = SettlesOn(&log, 1.0, GuitarHz(string), string, 0.0);
    Expect(ok, log, "T2 open string %d -> itself, |err| <= 1c", string);
  }
}

// ±30 c rather than a round in-tune value: an implementation that reported
// error against the nearest semitone would read 30 here, not -70 or +130.
void ExpectStatus(double cents, int32_t status, const char* label) {
  BeginGuitar();
  Log log;
  ToneOsc osc;
  FeedTone(&log, &osc, 1.0, Detune(GuitarHz(kStringE4), cents));
  const StatePred pred = [&](const kb_tuner_state& s) {
    return OnString(kStringE4, cents, 1.0)(s) && s.tuning_status == status;
  };
  const bool ok = HoldsFrom(log, IndexAt(log, 0.6), pred);
  Expect(ok, log, "T3 E4 %+.0fc -> err within 1c, %s by 600ms", cents, label);
}

void T3() {
  ExpectStatus(30.0, KB_TUNING_TOO_HIGH, "TooHigh");
  ExpectStatus(-30.0, KB_TUNING_TOO_LOW, "TooLow");
}

// +5 c off each spec frequency: 0.29% away, so echoing the string target
// instead of measuring fails the 0.1% bound.
void T4() {
  constexpr double kSpecHz[] = {82.41, 110.0, 146.83, 196.0, 246.94, 329.63};
  for (const double spec_hz : kSpecHz) {
    BeginGuitar();
    Log log;
    ToneOsc osc;
    const double hz = Detune(spec_hz, 5.0);
    const double midi = 69.0 + 12.0 * std::log2(hz / kA4Hz);
    FeedTone(&log, &osc, 1.0, hz);
    const bool ok = HoldsFrom(log, IndexAt(log, 0.6), [&](auto& s) {
      return NearHz(s.measured_hz, hz, 0.001) &&
             std::fabs(s.measured_midi - midi) <= 0.017;
    });
    Expect(ok, log, "T4 %.2fHz+5c -> measured Hz/MIDI within 0.1%%", spec_hz);
  }
}

// Ignoring A4 would read this tone 31.8 c flat of a 440-based E4.
void T5() {
  constexpr double kA4At432 = 432.0;
  BeginGuitar(kA4At432);
  Log log;
  const double hz = GuitarHz(kStringE4) * kA4At432 / kA4Hz;
  const bool ok = SettlesOn(&log, 1.0, hz, kStringE4, 0.0);
  Expect(ok, log, "T5 A4=432, E4 at 432 -> string 5, |err| <= 1c");
}

void T21() {
  BeginGuitar();
  Log log;
  const double e5_hz = 2.0 * GuitarHz(kStringE4);
  const bool ok = SettlesOn(&log, 1.0, e5_hz, kStringE4, 0.0);
  Expect(ok, log, "T21 E5 659.26Hz -> folds to E4 string, |err| <= 1c");
}

}  // namespace

void RunDetectTests() {
  T1();
  T2();
  T3();
  T4();
  T5();
  T21();
}

}  // namespace tuning_test
