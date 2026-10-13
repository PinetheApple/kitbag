// Silence, noise and out-of-range input. Every "nothing reported" check ends
// with a clean E4 that must be found, so a tuner that hears nothing fails.
#include "tuning_mode_test_support.h"

namespace tuning_test {
namespace {

void T17() {
  BeginGuitar();
  Log log;
  Feed(&log, 10.0, Silence);
  const bool quiet = HoldsFrom(log, 0, [](auto& s) {
    return s.can_hear_note == 0 && NoString(s);
  });
  const bool live = FollowUpFindsE4(&log);
  Expect(
      quiet && live,
      log,
      "T17 10 s silence -> no note, no string; then E4 found"
  );
}

void T18() {
  constexpr double kMinus30DbfsRms = 0.03162277660168379;
  BeginGuitar();
  Log log;
  Noise noise(kMinus30DbfsRms);
  Feed(&log, 10.0, [&] { return noise.Next(); });
  bool held_string = false;
  for (size_t i = 1; i < log.size(); ++i) {
    held_string =
        held_string || (!NoString(log[i - 1].s) && !NoString(log[i].s));
  }
  const bool live = FollowUpFindsE4(&log);
  Expect(
      !held_string && live,
      log,
      "T18 -30 dBFS noise 10 s -> no string beyond 1 hop; then E4 found"
  );
}

void ExpectNoStringFor(const char* label, double hz) {
  BeginGuitar();
  Log log;
  ToneOsc osc;
  FeedTone(&log, &osc, 3.0, hz);
  const bool quiet = HoldsFrom(log, 0, NoString);
  const bool live = FollowUpFindsE4(&log);
  Expect(quiet && live, log, "%s -> no string for 3 s; then E4 found", label);
}

void T19() {
  ExpectNoStringFor("T19 tone 20 Hz", 20.0);
  ExpectNoStringFor("T19 tone 12 kHz", 12000.0);
}

// Raised at 20 s (one hop of slack), not by 19 s, and cleared by the next note.
void T20() {
  BeginGuitar();
  Log log;
  Feed(&log, 19.0, Silence);
  const bool quiet_at_19 =
      HoldsFrom(log, 0, [](auto& s) { return s.no_sound_issue == 0; });
  const double raised_from = 20.0 + kHopSeconds;
  Feed(&log, raised_from + kHopSeconds - Elapsed(log), Silence);
  const bool raised = HoldsBetween(log, raised_from, Elapsed(log), [](auto& s) {
    return s.no_sound_issue == 1;
  });
  const bool live = FollowUpFindsE4(&log);
  const bool cleared = log.back().s.no_sound_issue == 0;
  Expect(
      quiet_at_19 && raised && live && cleared,
      log,
      "T20 no-sound issue absent at 19 s, raised by 20 s, cleared by a note"
  );
}

// Spec P11: E3 is 200 c above D3, inside 350 c, so it reads
// as D3 too high. A4 is 500 c above E4, nearer no string, and reads nothing.
void T22() {
  constexpr int32_t kStringD3 = 2;
  BeginGuitar();
  Log log;
  ToneOsc osc;
  FeedTone(&log, &osc, 3.0, MidiHz(52));
  const bool d3 = HoldsFrom(log, IndexAt(log, 0.6), [](auto& s) {
    return OnString(kStringD3, 200.0, 1.0)(s) &&
           s.tuning_status == KB_TUNING_TOO_HIGH;
  });
  Expect(d3, log, "T22 E3 164.81 Hz -> D3 string, +200c, too high");
  ExpectNoStringFor("T22 A4 440 Hz, 500c above E4", MidiHz(69));
}

}  // namespace

void RunSilenceTests() {
  T17();
  T18();
  T19();
  T20();
  T22();
}

}  // namespace tuning_test
