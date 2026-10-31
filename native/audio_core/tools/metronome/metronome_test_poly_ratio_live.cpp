#include "metronome_test_poly_model.h"

namespace metronome_test {
namespace {

constexpr double kRunSeconds = 30.0;
constexpr int64_t kChangeFrame = 230 * static_cast<int64_t>(kBlockFrames);
constexpr double kChangedBpm = 131.0;
constexpr int kRampIntervalBars = 1;

struct RampRun {
  PolySetup setup;
  double target_bpm;
  double step_bpm;
};

int64_t RunFrames() {
  return static_cast<int64_t>(kRunSeconds * kSampleRate);
}

void TestTempoChange() {
  const PolySetup setup{5, 3, 4, 4, 97.0};
  kitbag::Metronome metronome;
  StartPolyOnly(metronome, setup);
  const std::vector<float> left =
      RenderPolyLeft(metronome, RunFrames(), [&](int64_t at) {
        if (at == kChangeFrame) metronome.SetTempo(kChangedBpm);
      });
  const PolySpan first = FirstSpan(setup);
  const PolySpan after = SpanFrom(
      first,
      kChangeFrame,
      SecondsPerBeat(kChangedBpm, setup.denominator),
      first.against
  );
  ExpectPolyTicks(
      PolyLabel("tempo change to 131 keeps", setup),
      ModelPolyTicks({first, after}, setup.poly, RunFrames()),
      left
  );
}

std::vector<PolySpan> RampSpans(const RampRun& run) {
  const PolySetup& setup = run.setup;
  const int against = EffectiveAgainst(setup.against, setup.numerator);
  std::vector<PolySpan> spans;
  double seconds = 0.0;
  for (int bar = 0; seconds * kSampleRate < RunFrames(); ++bar) {
    const double bpm = ModelTempo(
        setup.bpm,
        run.target_bpm,
        run.step_bpm,
        bar / kRampIntervalBars
    );
    const double spb = SecondsPerBeat(bpm, setup.denominator);
    spans.push_back(
        {static_cast<double>(bar) * setup.numerator, seconds, spb, against}
    );
    seconds += setup.numerator * spb;
  }
  return spans;
}

std::string RampLabel(const RampRun& run) {
  char what[64];
  std::snprintf(
      what,
      sizeof what,
      "ramp to %.0f by %.0f:",
      run.target_bpm,
      run.step_bpm
  );
  return PolyLabel(what, run.setup);
}

void ExpectRamp(const RampRun& run) {
  kitbag::Metronome metronome;
  ConfigurePolyOnly(metronome, run.setup);
  metronome.SetRamp(
      true,
      run.setup.bpm,
      run.target_bpm,
      run.step_bpm,
      kRampIntervalBars,
      kRampBars,
      false
  );
  metronome.Start();
  const std::vector<float> left =
      RenderPolyLeft(metronome, RunFrames(), [](int64_t) {});
  ExpectPolyTicks(
      RampLabel(run),
      ModelPolyTicks(RampSpans(run), run.setup.poly, RunFrames()),
      left
  );
}

// D2 is the 400->200 case: a slowing step on a downbeat that a poly tick
// shares used to judge that tick against the new, shorter step.
void TestRamps() {
  ExpectRamp({{3, 2, 4, 4, 90.0}, 150.0, 15.0});
  ExpectRamp({{5, 3, 4, 4, 100.0}, 160.0, 20.0});
  ExpectRamp({{4, 3, 7, 8, 150.0}, 90.0, 15.0});
  ExpectRamp({{3, KB_POLY_AGAINST_BAR, 4, 4, kitbag::kMaxBpm}, 200.0, 50.0});
}

struct MeterChange {
  PolySetup setup;
  int numerator;
  int denominator;
};

void ExpectMeterChange(const MeterChange& change, const char* what) {
  const PolySetup& setup = change.setup;
  kitbag::Metronome metronome;
  StartPolyOnly(metronome, setup);
  const std::vector<float> left =
      RenderPolyLeft(metronome, RunFrames(), [&](int64_t at) {
        if (at != kChangeFrame) return;
        metronome.SetTimeSignature(change.numerator, change.denominator);
        MuteMainBeats(metronome, change.numerator);
      });
  const PolySpan first = FirstSpan(setup);
  const PolySpan after = SpanFrom(
      first,
      kChangeFrame,
      SecondsPerBeat(setup.bpm, change.denominator),
      EffectiveAgainst(setup.against, change.numerator)
  );
  ExpectPolyTicks(
      PolyLabel(what, setup),
      ModelPolyTicks({first, after}, setup.poly, RunFrames()),
      left
  );
}

void TestMeterChanges() {
  ExpectMeterChange(
      {{5, KB_POLY_AGAINST_BAR, 4, 4, 120.0}, 3, 4},
      "4/4 -> 3/4, against follows the bar:"
  );
  ExpectMeterChange(
      {{5, 4, 4, 4, 120.0}, 3, 4},
      "4/4 -> 3/4, explicit against stays:"
  );
  ExpectMeterChange(
      {{3, KB_POLY_AGAINST_BAR, 4, 4, 120.0}, 7, 8},
      "4/4 -> 7/8, against follows the bar:"
  );
  ExpectMeterChange(
      {{3, 2, 4, 4, 120.0}, 7, 8},
      "4/4 -> 7/8, explicit against stays:"
  );
}

}  // namespace

void RunPolyRatioLiveTests() {
  TestTempoChange();
  TestRamps();
  TestMeterChanges();
}

}  // namespace metronome_test
