// Manual-mode wrong-string hint (spec P20-P23), target E4 throughout.
#include "tuning_mode_test_support.h"

namespace tuning_test {
namespace {

bool HintsG3Below(const kb_tuner_state& s) {
  return s.possible_wrong_string == kStringG3 &&
         s.wrong_string_direction == KB_WRONG_STRING_BELOW;
}

// The 0.8 s run is followed by silence so a hint that fires late still counts.
void T23() {
  BeginManual(kStringE4);
  Log log;
  ToneOsc osc;
  FeedTone(&log, &osc, 1.2, GuitarHz(kStringG3));
  const bool fired = HintsG3Below(log.back().s);

  BeginManual(kStringE4);
  Log short_log;
  ToneOsc short_osc;
  FeedTone(&short_log, &short_osc, 0.8, GuitarHz(kStringG3));
  Feed(&short_log, 1.0, Silence);
  const bool quiet = HoldsFrom(short_log, 0, NoHint);
  Expect(
      fired && quiet,
      log,
      "T23 G3 vs target E4: hint G3/below at 1.2 s, none for 0.8 s"
  );
}

// D4 is 2 semitones under E4 (inside 3.5): heard and measured, never hinted.
void T24() {
  BeginManual(kStringE4);
  Log log;
  ToneOsc osc;
  const double d4_hz = MidiHz(62);
  FeedTone(&log, &osc, 3.0, d4_hz);
  const bool heard = HoldsFrom(log, IndexAt(log, 0.6), [&](auto& s) {
    return OnString(kStringE4, -200.0, 1.0)(s) &&
           NearHz(s.measured_hz, d4_hz, 0.001);
  });
  const bool quiet = HoldsFrom(log, 0, NoHint);
  Expect(heard && quiet, log, "T24 D4 vs target E4 -> heard at -200c, no hint");
}

// Then the same G3 at full level must hint, proving the quiet run was gated.
void T25() {
  constexpr double kBelowGateRms = 0.0003;
  BeginManual(kStringE4);
  Log log;
  const double g3_hz = GuitarHz(kStringG3);
  ToneOsc quiet_osc(kBelowGateRms / ToneOsc::UnitRms(g3_hz));
  FeedTone(&log, &quiet_osc, 3.0, g3_hz);
  const bool quiet = HoldsFrom(log, 0, NoHint);
  ToneOsc loud_osc;
  FeedTone(&log, &loud_osc, 2.0, g3_hz);
  const bool fired = HintsG3Below(log.back().s);
  Expect(
      quiet && fired,
      log,
      "T25 G3 at RMS 0.0003 -> no hint; at full level -> hint"
  );
}

}  // namespace

void RunWrongStringTests() {
  T23();
  T24();
  T25();
}

}  // namespace tuning_test
