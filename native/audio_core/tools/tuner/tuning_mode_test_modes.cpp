// Behaviour §6 has no T-id for: the P18 status split, chromatic mode, the
// auto-mode hint, and the P8 blend weight and P9 hold median T15/T8 miss.
#include "tuning_mode_test_support.h"

namespace tuning_test {
namespace {

constexpr int32_t kStringB3 = 4;

// ±7.3 and ±7.7 straddle the rounding edge at 7.5, so an unrounded comparison
// or a [-7, +8) split each misfile one of them.
void ExpectStatusAt(int32_t string, double cents, int32_t status) {
  BeginGuitar();
  Log log;
  ToneOsc osc;
  FeedTone(&log, &osc, 1.0, Detune(GuitarHz(string), cents));
  const bool ok = HoldsFrom(log, IndexAt(log, 0.6), [&](auto& s) {
    return OnString(string, cents, 0.1)(s) && s.tuning_status == status;
  });
  Expect(ok, log, "P18 string %d %+.1fc -> status %d", string, cents, status);
}

// E2's in-tune window is ±12 c; the status still splits at ±7.
void P18StatusSplit() {
  ExpectStatusAt(kStringE4, -7.3, KB_TUNING_IN_TUNE);
  ExpectStatusAt(kStringE4, 7.3, KB_TUNING_IN_TUNE);
  ExpectStatusAt(kStringE4, -7.7, KB_TUNING_TOO_LOW);
  ExpectStatusAt(kStringE4, 7.7, KB_TUNING_TOO_HIGH);
  ExpectStatusAt(kStringE2, -7.7, KB_TUNING_TOO_LOW);
}

// Neither note is a guitar string, and C#3 +23 c sits 77 c under D3, so a
// string-relative or unrounded target cannot produce these readings.
void ExpectChromatic(int32_t midi, double cents) {
  BeginGuitar();
  kb_tuner_set_chromatic(g_engine);
  Log log;
  ToneOsc osc;
  FeedTone(&log, &osc, 1.0, Detune(MidiHz(midi), cents));
  const bool ok = HoldsFrom(log, IndexAt(log, 0.6), [&](auto& s) {
    return s.can_hear_note == 1 && NoString(s) && s.target_midi == midi &&
           std::fabs(s.tuning_error_cents - cents) <= 1.0;
  });
  Expect(
      ok,
      log,
      "chromatic MIDI %d %+.0fc -> that note, no string",
      midi,
      cents
  );
}

// Then auto again: the same E3 reads against the D3 string, as in T22.
void ChromaticMode() {
  ExpectChromatic(49, 23.0);
  ExpectChromatic(66, -38.0);
  ExpectChromatic(52, 0.0);
  kb_tuner_set_target_string(g_engine, KB_TUNER_AUTO_STRING);
  Log log;
  ToneOsc osc;
  FeedTone(&log, &osc, 2.0, MidiHz(52));
  const bool on_d3 = HoldsFrom(log, IndexAt(log, 0.6), OnString(2, 200.0, 1.0));
  Expect(on_d3, log, "chromatic -> auto: E3 reads as D3 +200c again");
}

bool HintsB3Below(const kb_tuner_state& s) {
  return s.possible_wrong_string == kStringB3 &&
         s.wrong_string_direction == KB_WRONG_STRING_BELOW;
}

// While a held E4 drains its confidence, B3 is hinted; once B3 takes over the
// hint clears. A switch on the first B3 hop would never show E4 with a hint.
void AutoHint() {
  BeginGuitar();
  Log log;
  ToneOsc osc;
  FeedTone(&log, &osc, 1.2, GuitarHz(kStringE4));
  const bool quiet_before = HoldsFrom(log, 0, NoHint);
  const size_t step = log.size();
  FeedTone(&log, &osc, 1.5, GuitarHz(kStringB3));
  bool hinted_on_e4 = false;
  for (size_t i = step; i < log.size(); ++i) {
    hinted_on_e4 = hinted_on_e4 || (log[i].s.current_string == kStringE4 &&
                                    HintsB3Below(log[i].s));
  }
  const bool switched =
      HoldsFrom(log, IndexAt(log, Elapsed(log) - 0.3), [](auto& s) {
        return s.current_string == kStringB3 && NoHint(s);
      });
  Expect(
      quiet_before && hinted_on_e4 && switched,
      log,
      "auto E4 -> B3: hint B3/below while E4 held, then B3 without a hint"
  );
}

// Three B3 hops inside E4 raise the hint without draining E4; E4's return
// must withdraw it, or a stray pick leaves it standing for good.
void AutoHintWithdrawn() {
  BeginGuitar();
  Log log;
  ToneOsc osc;
  FeedTone(&log, &osc, 1.2, GuitarHz(kStringE4));
  FeedTone(&log, &osc, 3 * kHopSeconds, GuitarHz(kStringB3));
  const bool raised = HintsB3Below(log.back().s);
  FeedTone(&log, &osc, 1.0, GuitarHz(kStringE4));
  const bool withdrawn =
      HoldsFrom(log, IndexAt(log, Elapsed(log) - 0.5), [](auto& s) {
        return s.current_string == kStringE4 && NoHint(s);
      });
  Expect(
      raised && withdrawn,
      log,
      "auto E4, 3 hops B3, E4 -> hint raised, then withdrawn on E4"
  );
}

// Hop 2 after a +50 c step reads 17 c at P8's 0.25 weight (one half-new frame
// then one new); 0.5 would read 31 c and 0.15 11 c. T15 passes all three.
void P8BlendWeight() {
  BeginGuitar();
  Log log;
  ToneOsc osc;
  FeedTone(&log, &osc, 1.0, GuitarHz(kStringE4));
  FeedTone(&log, &osc, 2 * kHopSeconds, Detune(GuitarHz(kStringE4), 50.0));
  const double error = log.back().s.tuning_error_cents;
  Expect(
      error >= 13.0 && error <= 22.0,
      log,
      "P8 +50c step, hop 2 reads 13-22c (got %.1f)",
      error
  );
}

// Two hops at -60 c end a steady E4: the blend is at -30 c when the tone
// stops, but four of the last seven estimates are 0 c, so P9 holds 0.
void P9HoldMedian() {
  BeginGuitar();
  Log log;
  ToneOsc osc;
  FeedTone(&log, &osc, 1.0, GuitarHz(kStringE4));
  FeedTone(&log, &osc, 2 * kHopSeconds, Detune(GuitarHz(kStringE4), -60.0));
  const double stop = Elapsed(log);
  Feed(&log, 1.0, Silence);
  const bool median =
      HoldsBetween(log, stop + kHopSeconds, stop + 1.0, [](auto& s) {
        return OnString(kStringE4, 0.0, 2.0)(s);
      });
  Expect(median, log, "P9 E4 with a -60c tail, then silence -> holds 0c");
}

}  // namespace

void RunModeTests() {
  P18StatusSplit();
  ChromaticMode();
  AutoHint();
  AutoHintWithdrawn();
  P8BlendWeight();
  P9HoldMedian();
}

}  // namespace tuning_test
