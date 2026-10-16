// Timing: first reading, time to tuned, release hold, ratio reset, pause.
#include "tuning_mode_test_support.h"

namespace tuning_test {
namespace {

bool HasString(const kb_tuner_state& s) {
  return s.can_hear_note == 1 && s.current_string != KB_TUNER_NO_STRING;
}

void T6() {
  BeginGuitar();
  Log log;
  ToneOsc osc;
  FeedTone(&log, &osc, 1.0, GuitarHz(kStringE4));
  const double first = FirstTime(log, 0, HasString);
  const bool ok = first >= 0.085 && first <= 0.5;
  Expect(
      ok,
      log,
      "T6 first reading in [85, 500] ms (got %.0f ms)",
      first * 1e3
  );
}

// A single-frame in-tune flag would fire at the first reading, before 0.74 s.
void T7() {
  BeginGuitar();
  Log log;
  ToneOsc osc;
  FeedTone(&log, &osc, 2.0, GuitarHz(kStringE4));
  const double tuned = FirstTime(log, 0, [](const kb_tuner_state& s) {
    return IsTuned(s) && s.current_string == kStringE4;
  });
  const bool ok = tuned >= 0.74 && tuned <= 1.1;
  Expect(ok, log, "T7 E4 tuned in [0.74, 1.1] s (got %.3f s)", tuned);
}

struct Release {
  bool heard = false;  // a reading at the moment the tone stopped
  bool held = false;   // the stopped tone's pitch reported until it cleared
  double hold = -1.0;  // seconds from the stop to can_hear_note = 0
  long hold_hops = -1;
  long tone_hops = 0;  // hops of tone fed
  Log log;
};

// Rounding to the nearest hop is a half-hop tolerance on summed float times.
long ToHops(double seconds) {
  return std::lround(seconds / kHopSeconds);
}

// `begin` picks the mode; Begin's SetTuning returns the next scenario to auto.
Release ReleaseAfter(double tone_seconds, void (*begin)()) {
  begin();
  Release r;
  ToneOsc osc;
  const double e4_hz = GuitarHz(kStringE4);
  FeedTone(&r.log, &osc, tone_seconds, e4_hz);
  const double stop = Elapsed(r.log);
  Feed(&r.log, 2.0, Silence);
  const int at_stop = IndexAt(r.log, stop);
  const double clear =
      FirstTime(r.log, at_stop, [](auto& s) { return s.can_hear_note == 0; });
  r.tone_hops = ToHops(stop);
  r.heard = r.log[static_cast<size_t>(at_stop)].s.can_hear_note == 1;
  r.hold = clear < 0.0 ? -1.0 : clear - stop;
  r.hold_hops = clear < 0.0 ? -1 : ToHops(r.hold);
  r.held = clear > stop &&
           HoldsBetween(r.log, stop, clear - kHopSeconds, [&](auto& s) {
             return s.can_hear_note == 1 && NearHz(s.measured_hz, e4_hz, 0.001);
           });
  return r;
}

void BeginAuto() {
  BeginGuitar();
}
void BeginManualE4() {
  BeginManual(kStringE4);
}
void BeginChromatic() {
  BeginGuitar();
  kb_tuner_set_chromatic(g_engine);
}

// P10 keeps the counter in every mode, so the full hold is not auto-only.
long ExpectFullHold(const char* mode, void (*begin)()) {
  const Release full = ReleaseAfter(2.0, begin);
  Expect(
      full.heard && full.held && full.hold >= 0.6 && full.hold <= 0.85,
      full.log,
      "T8 %s E4 then silence -> held, cleared in [0.6, 0.85] s (got %.3f s)",
      mode,
      full.hold
  );
  return full.hold_hops;
}

// Measured holds: 0.3 s tone 0.38 s, full tone 0.77 s (the 2-hop frame still
// hears the tone one hop on). P10 never exceeds hops heard: the tone + 2 cap.
void T8() {
  const long full_hops = ExpectFullHold("auto", BeginAuto);
  ExpectFullHold("manual", BeginManualE4);
  ExpectFullHold("chromatic", BeginChromatic);
  constexpr double kShortTone = 0.3;
  const Release brief = ReleaseAfter(kShortTone, BeginAuto);
  const bool shorter = brief.hold_hops > 0 && brief.hold_hops + 1 < full_hops &&
                       brief.hold_hops <= brief.tone_hops + 2;
  Expect(
      brief.heard && brief.held && shorter,
      brief.log,
      "T8 0.3 s E4 -> hold shorter than full, <= tone + 2 hops "
      "(got %ld vs %ld hops)",
      brief.hold_hops,
      full_hops
  );
}

// The 4096-sample frame and the P8 blend delay the error leaving the window,
// so "within one hop" is counted from the first out-of-window reading.
void T9() {
  BeginGuitar();
  Log log;
  ToneOsc osc;
  FeedTone(&log, &osc, 1.2, Detune(GuitarHz(kStringE4), 4.0));
  const size_t step = log.size();
  const bool accumulated = log.back().s.in_tune_ratio > 0.5;
  FeedTone(&log, &osc, 1.0, Detune(GuitarHz(kStringE4), 12.0));
  int out = -1;
  for (size_t i = step; i < log.size() && i < step + 10 && out < 0; ++i) {
    const kb_tuner_state& s = log[i].s;
    if (std::fabs(s.tuning_error_cents) > s.in_tune_threshold_cents &&
        s.in_tune_threshold_cents > 0.0) {
      out = static_cast<int>(i);
    }
  }
  const bool reset = out >= 0 && HoldsFrom(log, out + 1, [](auto& s) {
                       return s.in_tune_ratio == 0.0;
                     });
  Expect(accumulated && reset, log, "T9 +4c -> +12c resets ratio within a hop");
}

bool PausedFor(const Log& log, double reset, uint32_t* paused_id) {
  const double hop_slack = kHopSeconds + 1e-6;
  const bool paused =
      HoldsBetween(log, reset, reset + 0.5 - hop_slack, [&](auto& s) {
        return s.listening_paused == 1 && s.measurement_id == *paused_id;
      });
  const bool resumed =
      HoldsBetween(log, reset + 0.5 + hop_slack, Elapsed(log), [&](auto& s) {
        return s.listening_paused == 0;
      });
  return paused && resumed && log.back().s.measurement_id > *paused_id;
}

void T26() {
  BeginGuitar();
  Log log;
  ToneOsc osc;
  FeedTone(&log, &osc, 1.0, GuitarHz(kStringE4));
  const bool heard = HasString(log.back().s);
  const double reset = Elapsed(log);
  kb_tuner_reset_note_presence(g_engine, 500.0);
  kb_tuner_state now{};
  kb_tuner_read_state(g_engine, &now);
  const bool cleared = heard && now.can_hear_note == 0 &&
                       now.current_string == KB_TUNER_NO_STRING &&
                       now.in_tune_ratio == 0.0;
  Expect(cleared, log, "T26 reset clears a held E4 at once");
  uint32_t paused_id = now.measurement_id;
  FeedTone(&log, &osc, 1.5, GuitarHz(kStringE4));
  Expect(
      PausedFor(log, reset, &paused_id),
      log,
      "T26 paused 500+-43 ms, id frozen"
  );
  const bool resumed = HoldsFrom(
      log,
      IndexAt(log, reset + 0.5 + kHopSeconds + 0.6),
      OnString(kStringE4, 0.0, 1.0)
  );
  Expect(resumed, log, "T26 detection resumes within 600 ms of the pause");
}

}  // namespace

void RunTimingTests() {
  T6();
  T7();
  T8();
  T9();
  T26();
}

}  // namespace tuning_test
