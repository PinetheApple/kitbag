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

void T8() {
  BeginGuitar();
  Log log;
  ToneOsc osc;
  const double e4_hz = GuitarHz(kStringE4);
  FeedTone(&log, &osc, 2.0, e4_hz);
  const double stop = Elapsed(log);
  const bool was_tuned = IsTuned(log.back().s);
  Feed(&log, 3.0, Silence);
  const bool held = HoldsBetween(log, stop, stop + 1.0, [&](auto& s) {
    return s.can_hear_note == 1 && NearHz(s.measured_hz, e4_hz, 0.001);
  });
  const bool cleared = HoldsBetween(log, stop + 1.4, Elapsed(log), [](auto& s) {
    return s.can_hear_note == 0;
  });
  Expect(
      was_tuned && held && cleared,
      log,
      "T8 tuned E4 then silence -> held 1.0 s, cleared by 1.4 s"
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
