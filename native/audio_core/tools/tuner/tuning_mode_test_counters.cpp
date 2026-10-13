// Counters and directions §6 leaves loose: the hint's upper side, the P10
// confidence costs, the exact no-sound hop, and what a pause discards.
#include "tuning_mode_test_support.h"

namespace tuning_test {
namespace {

constexpr int32_t kStringB3 = 4;

// T23 only ever hints below; a direction stuck on BELOW passes it.
void HintAbove() {
  BeginManual(kStringE2);
  Log log;
  ToneOsc osc;
  FeedTone(&log, &osc, 1.5, GuitarHz(kStringG3));
  const kb_tuner_state& s = log.back().s;
  const bool ok = s.possible_wrong_string == kStringG3 &&
                  s.wrong_string_direction == KB_WRONG_STRING_ABOVE;
  Expect(ok, log, "manual E2, G3 for 1.5 s -> hint G3/above");
}

// A held E4 has the full 17 confidence. B3 names another string, costing 2 a
// hop, so E4 holds 8 hops and B3 takes over by hop 10; at 1 a hop, by 18.
void ConfidenceCost() {
  BeginGuitar();
  Log log;
  ToneOsc osc;
  FeedTone(&log, &osc, 1.2, GuitarHz(kStringE4));
  const size_t step = log.size();
  FeedTone(&log, &osc, 1.0, GuitarHz(kStringB3));
  const bool held = log[step + 7].s.current_string == kStringE4;
  const bool taken = log[step + 9].s.current_string == kStringB3;
  Expect(held && taken, log, "E4 -> B3: E4 held 8 hops, B3 by hop 10");
}

// P19 is 20 s: the first hop at or past it raises the issue, not one either
// side. T20 allows a hop of slack after 20 s.
void NoSoundHop() {
  BeginGuitar();
  Log log;
  Feed(&log, 21.0, Silence);
  const double raised =
      FirstTime(log, 0, [](auto& s) { return s.no_sound_issue == 1; });
  const bool ok = raised >= 20.0 && raised < 20.0 + kHopSeconds;
  Expect(ok, log, "P19 no-sound first raised at the 20 s hop (%.3f s)", raised);
}

// B3 sounds through a pause, E4 after it; chromatic, so a mixed frame would
// read as whatever it is. Paused audio must never be analysed.
void PauseDiscards() {
  BeginGuitar();
  kb_tuner_set_chromatic(g_engine);
  kb_tuner_reset_note_presence(g_engine, 500.0);
  Log log;
  ToneOsc osc;
  FeedTone(&log, &osc, 0.5, GuitarHz(kStringB3));
  const double resume = Elapsed(log);
  FeedTone(&log, &osc, 1.0, GuitarHz(kStringE4));
  const bool clean = HoldsFrom(log, 0, [](auto& s) {
    return s.can_hear_note == 0 || s.target_midi == 64;
  });
  const double first =
      FirstTime(log, 0, [](auto& s) { return s.can_hear_note == 1; });
  const bool full_frame = first >= resume + 2 * kHopSeconds - 1e-6;
  Expect(
      clean && full_frame,
      log,
      "pause: B3 during it never read; E4 read a frame after (%.3f s)",
      first - resume
  );
}

// A restart (kb_tuner_offline_init, as kb_tuner_start does) must neither
// reuse an id a poller has seen nor cancel a pause asked for before it.
void RestartKeepsIdAndPause() {
  BeginGuitar();
  Log log;
  Feed(&log, 0.5, Silence);
  const uint32_t before = log.back().s.measurement_id;
  kb_tuner_reset_note_presence(g_engine, 500.0);
  kb_tuner_offline_init(g_engine, kSampleRate);
  Log after;
  Feed(&after, 1.0, Silence);
  const bool paused = after.front().s.listening_paused == 1 &&
                      after.front().s.measurement_id == before;
  const bool fresh = after.back().s.measurement_id > before;
  Expect(paused && fresh, after, "restart: pause survives, ids never repeat");
}

// P11's edge, from E4 upward where no other string is nearer: 345 c is taken
// as E4, 355 c is no string at all.
void AutoStringEdge() {
  for (const double cents : {345.0, 355.0}) {
    BeginGuitar();
    Log log;
    ToneOsc osc;
    FeedTone(&log, &osc, 2.0, Detune(GuitarHz(kStringE4), cents));
    const bool inside = cents < 350.0;
    const bool ok =
        inside
            ? HoldsFrom(log, IndexAt(log, 0.6), OnString(kStringE4, cents, 1.0))
            : HoldsFrom(log, 0, NoString);
    Expect(ok, log, "P11 E4 %+.0fc -> %s", cents, inside ? "E4" : "no string");
  }
}

// A string a semitone flat still reads as itself, the case auto mode is for.
void DetunedString() {
  BeginGuitar();
  Log log;
  ToneOsc osc;
  FeedTone(&log, &osc, 2.0, Detune(GuitarHz(kStringE4), -100.0));
  const bool ok = HoldsFrom(log, IndexAt(log, 0.6), [](auto& s) {
    return OnString(kStringE4, -100.0, 1.0)(s) &&
           s.tuning_status == KB_TUNING_TOO_LOW;
  });
  Expect(ok, log, "detuned E4 -100c -> E4 string, too low");
}

}  // namespace

void RunCounterTests() {
  HintAbove();
  ConfidenceCost();
  NoSoundHop();
  PauseDiscards();
  RestartKeepsIdAndPause();
  AutoStringEdge();
  DetunedString();
}

}  // namespace tuning_test
