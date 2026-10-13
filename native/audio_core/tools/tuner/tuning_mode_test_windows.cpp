// In-tune windows per instrument and string (spec P12-P14). Offsets sit 0.5 c
// either side of each window edge, so one shared window cannot pass them all.
#include "tuning_mode_test_support.h"

namespace tuning_test {
namespace {

struct Tuning {
  int32_t instrument;
  const int32_t* midis;
  int32_t count;
  const char* name;
};

constexpr Tuning kGuitarTuning{
    KB_TUNER_INSTRUMENT_GUITAR,
    kGuitar,
    6,
    "guitar"
};
constexpr Tuning kBassTuning{KB_TUNER_INSTRUMENT_BASS, kBass4, 4, "bass"};
constexpr Tuning kUkuleleTuning{
    KB_TUNER_INSTRUMENT_UKULELE,
    kUkulele,
    4,
    "uke"
};

// Both outcomes also require the note to be heard on the right string at the
// right error with the right window, so a silent tuner cannot pass "never".
void ExpectWindow(
    const char* tid,
    const Tuning& tuning,
    int32_t string,
    double cents,
    double window
) {
  Begin(tuning.instrument, tuning.midis, tuning.count);
  Log log;
  ToneOsc osc;
  FeedTone(&log, &osc, 3.0, Detune(MidiHz(tuning.midis[string]), cents));
  const bool heard = HoldsFrom(log, IndexAt(log, 0.6), [&](auto& s) {
    return OnString(string, cents, 1.0)(s) &&
           s.in_tune_threshold_cents == window;
  });
  const bool tuned = FirstTime(log, 0, IsTuned) >= 0.0;
  const bool expect_tuned = std::fabs(cents) < window;
  Expect(
      heard && tuned == expect_tuned,
      log,
      "%s %s string %d %+.1fc -> %s (window +-%.0fc)",
      tid,
      tuning.name,
      string,
      cents,
      expect_tuned ? "tuned" : "never tuned in 3 s",
      window
  );
}

void ExpectBothSides(
    const char* tid,
    const Tuning& tuning,
    int32_t string,
    double cents,
    double window
) {
  ExpectWindow(tid, tuning, string, cents, window);
  ExpectWindow(tid, tuning, string, -cents, window);
}

void T10() {
  ExpectBothSides("T10", kGuitarTuning, kStringE4, 6.5, 7.0);
  ExpectBothSides("T10", kGuitarTuning, kStringE4, 7.5, 7.0);
}

void T11() {
  ExpectBothSides("T11", kGuitarTuning, kStringE2, 11.5, 12.0);
  ExpectBothSides("T11", kGuitarTuning, kStringE2, 12.5, 12.0);
}

// Strings are indices into the re-entrant G4 C4 E4 A4 list.
void T12() {
  constexpr int32_t kC4 = 1;
  constexpr int32_t kA4 = 3;
  ExpectBothSides("T12", kUkuleleTuning, kC4, 13.5, 14.0);
  ExpectBothSides("T12", kUkuleleTuning, kA4, 10.5, 10.0);
}

void T13() {
  constexpr int32_t kE1 = 0;
  constexpr int32_t kA1 = 1;
  constexpr int32_t kG2 = 3;
  ExpectBothSides("T13", kBassTuning, kE1, 11.5, 12.0);
  ExpectBothSides("T13", kBassTuning, kA1, 10.5, 10.0);
  ExpectBothSides("T13", kBassTuning, kG2, 7.5, 7.0);
}

}  // namespace

void RunWindowTests() {
  T10();
  T11();
  T12();
  T13();
}

}  // namespace tuning_test
