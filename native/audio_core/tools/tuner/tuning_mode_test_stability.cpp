// Smoothing and stability: vibrato, the P8 blend/replace split, stray frames.
#include "tuning_mode_test_support.h"

namespace tuning_test {
namespace {

// Spec §6 T14's vibrato: a 5 Hz sine of ±3 c depth around the centre pitch.
class Vibrato {
 public:
  double Next() {
    constexpr double kRateHz = 5.0;
    constexpr double kDepthCents = 3.0;
    return kDepthCents *
           std::sin(
               kTau * kRateHz * static_cast<double>(sample_++) / kSampleRate
           );
  }

 private:
  int64_t sample_ = 0;
};

double StdDev(const std::vector<double>& values, double* mean) {
  *mean = 0.0;
  for (const double v : values) *mean += v / values.size();
  double variance = 0.0;
  for (const double v : values) {
    variance += (v - *mean) * (v - *mean) / values.size();
  }
  return std::sqrt(variance);
}

// Error per settled reading; off-string readings count as 1000 c so they
// cannot hide in the spread.
std::vector<double> SettledErrors(const Log& log, double from_s) {
  std::vector<double> errors;
  for (int i = std::max(IndexAt(log, from_s), 0);
       i < static_cast<int>(log.size());
       ++i) {
    const kb_tuner_state& s = log[i].s;
    errors.push_back(
        s.current_string == kStringE4 ? s.tuning_error_cents : 1e3
    );
  }
  return errors;
}

// Centred on +5 c so a reading frozen at 0 fails the mean, and the input's
// own spread is asserted so an unsmoothed tracker cannot meet the 1 c bound.
void T14() {
  constexpr double kCentre = 5.0;
  BeginGuitar();
  Log log;
  ToneOsc osc;
  Vibrato vibrato;
  std::vector<double> input;
  Feed(&log, 5.0, [&] {
    const double cents = kCentre + vibrato.Next();
    input.push_back(cents);
    return osc.Next(Detune(GuitarHz(kStringE4), cents));
  });
  double input_mean = 0.0;
  double mean = 0.0;
  const double input_sd = StdDev(input, &input_mean);
  const double sd = StdDev(SettledErrors(log, 1.0), &mean);
  if (input_sd < 1.5) {
    std::fprintf(stderr, "SETUP FAILED: T14 vibrato sd %.2f c\n", input_sd);
    ++kitbag_test::g_failures;
  }
  const bool ok = sd <= 1.0 && std::fabs(mean - input_mean) <= 1.0;
  Expect(
      ok,
      log,
      "T14 vibrato sd %.2fc in -> sd <= 1c out (got %.2f)",
      input_sd,
      sd
  );
}

// Feeds 1 s of E4 at 0 c then 1 s at +step_cents from the same oscillator;
// returns the index of the first reading after the step.
size_t StepE4(Log* log, double step_cents) {
  BeginGuitar();
  ToneOsc osc;
  FeedTone(log, &osc, 1.0, GuitarHz(kStringE4));
  const size_t step = log->size();
  FeedTone(log, &osc, 1.0, Detune(GuitarHz(kStringE4), step_cents));
  return step;
}

// P8's 0.25 blend weight caps the error at 28.9 c after three hops, so reaching
// 45 c sooner means the blend is missing; by hop 10 it must be there.
void T15Blend() {
  Log log;
  const size_t step = StepE4(&log, 50.0);
  const bool settled = OnString(kStringE4, 0.0, 1.0)(log[step - 1].s);
  int first = -1;
  bool monotonic = true;
  for (size_t i = step; i < log.size() && first < 0; ++i) {
    monotonic = monotonic && log[i].s.tuning_error_cents >=
                                 log[i - 1].s.tuning_error_cents - 0.1;
    if (log[i].s.tuning_error_cents >= 45.0) {
      first = static_cast<int>(i - step) + 1;
    }
  }
  Expect(
      settled && first >= 4 && first <= 10,
      log,
      "T15 0 -> +50c reaches 45c after hop 3, by hop 10 (got hop %d)",
      first
  );
  Expect(
      settled && first > 0 && monotonic,
      log,
      "T15 0 -> +50c rises monotonically"
  );
}

void T15Replace() {
  Log log;
  const size_t step = StepE4(&log, 100.0);
  const bool settled = OnString(kStringE4, 0.0, 1.0)(log[step - 1].s);
  const bool jumped = HoldsFrom(
      log,
      static_cast<int>(step) + 1,
      OnString(kStringE4, 100.0, 2.0)
  );
  Expect(settled && jumped, log, "T15 0 -> +100c reads 100+-2c within 2 hops");
}

void T16() {
  BeginGuitar();
  Log log;
  ToneOsc osc;
  FeedTone(&log, &osc, 1.0, GuitarHz(kStringE4));
  FeedTone(&log, &osc, kHopSeconds, GuitarHz(4));
  FeedTone(&log, &osc, 1.0, GuitarHz(kStringE4));
  const bool ok = HoldsFrom(log, IndexAt(log, 0.6), [](auto& s) {
    return s.current_string == kStringE4;
  });
  Expect(ok, log, "T16 one-hop B3 burst inside E4 keeps string 5");
}

}  // namespace

void RunStabilityTests() {
  T14();
  T15Blend();
  T15Replace();
  T16();
}

}  // namespace tuning_test
