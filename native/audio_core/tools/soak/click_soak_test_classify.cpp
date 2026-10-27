#include <algorithm>

#include "soak_cli.h"
#include "soak_fixtures.h"

namespace soak_test {

namespace {

using click_soak::Report;
using click_soak::ThresholdFailures;

std::vector<double>
Shifted(std::vector<double> times, size_t index, double ms) {
  times[index] += ms / 1000.0;
  return times;
}

void ExpectNoFaults(const Report& report, const char* label) {
  Check(report.dropped == 0, label);
  Check(report.doubled == 0, label);
  Check(report.jittered == 0, label);
}

void TestPerfect() {
  const Report report =
      Classify(Synthesize(GridTimes(), 1.0, kRate), GridTimes());
  Check(report.onsets_detected == kBeats, "perfect: one onset per click");
  Check(report.clicks_analysed == kBeats, "perfect: every beat matched");
  Check(report.intervals == kBeats - 1, "perfect: every interval judged");
  ExpectNoFaults(report, "perfect: no dropped/doubled/jittered");
  Check(
      report.error_max_abs_ms <= kTightMs,
      "perfect: interval error within 1.5 samples"
  );
  Check(
      report.offset_max_abs_ms <= kTightMs,
      "perfect: offset within 1.5 samples"
  );
  Check(ThresholdFailures(report).empty(), "perfect: passes");
}

void TestJittered() {
  const auto clicks = Shifted(GridTimes(), 13, 3.0);
  const Report report = Classify(Synthesize(clicks, 1.0, kRate), GridTimes());
  Check(report.jittered == 1, "jitter 3 ms: exactly one click jittered");
  Check(
      report.jittered_at.size() == 1 &&
          Near(report.jittered_at[0].time_sec, clicks[13], 1e-4) &&
          Near(report.jittered_at[0].value_ms, 3.0, kTightMs),
      "jitter 3 ms: reported at click 13 as +3 ms"
  );
  Check(
      report.dropped == 0 && report.doubled == 0,
      "jitter 3 ms: no drop/double"
  );
  Check(
      Near(report.error_max_abs_ms, 3.0, kTightMs),
      "jitter 3 ms: max interval error 3 ms"
  );
  Check(report.intervals_off == 2, "jitter 3 ms: intervals into and out of it");
  Check(
      ThresholdFailures(report).size() == 2,
      "jitter 3 ms: fails on the click and its intervals only"
  );
}

// Brackets kJitterToleranceMs, so a looser or tighter limit fails one side.
void TestJitterTolerance() {
  const auto under = Shifted(GridTimes(), 21, 0.7);
  const Report inside = Classify(Synthesize(under, 1.0, kRate), GridTimes());
  Check(inside.jittered == 0, "jitter 0.7 ms: within tolerance");
  Check(inside.intervals_off == 0, "jitter 0.7 ms: intervals within tolerance");
  Check(
      Near(inside.deviation_max_abs_ms, 0.7, kTightMs),
      "jitter 0.7 ms: deviation measured"
  );
  const auto over = Shifted(GridTimes(), 21, 1.3);
  const Report outside = Classify(Synthesize(over, 1.0, kRate), GridTimes());
  Check(outside.jittered == 1, "jitter 1.3 ms: beyond tolerance");
  Check(
      outside.intervals_off == 2,
      "jitter 1.3 ms: both intervals beyond tolerance"
  );
}

void TestMissing() {
  auto clicks = GridTimes();
  clicks.erase(clicks.begin() + 17);
  const Report one = Classify(Synthesize(clicks, 1.0, kRate), GridTimes());
  Check(one.dropped == 1, "missing: one dropped");
  Check(
      one.dropped_at.size() == 1 &&
          Near(one.dropped_at[0].time_sec, GridTimes()[17], 1e-4),
      "missing: drop reported at beat 17"
  );
  Check(one.doubled == 0 && one.jittered == 0, "missing: nothing else flagged");
  Check(one.clicks_analysed == kBeats - 1, "missing: 39 clicks analysed");
  Check(
      one.intervals == kBeats - 3,
      "missing: both intervals across the gap skipped"
  );
  clicks.erase(clicks.begin() + 22, clicks.begin() + 24);
  const Report three = Classify(Synthesize(clicks, 1.0, kRate), GridTimes());
  Check(three.dropped == 3, "missing: 1 + 2 consecutive = 3 dropped");
  Check(three.jittered == 0, "missing: consecutive drops are not jitter");
}

void TestDoubled() {
  auto after = GridTimes();
  after.push_back(GridTimes()[5] + (0.3 * Interval()));
  std::sort(after.begin(), after.end());
  const Report late = Classify(Synthesize(after, 1.0, kRate), GridTimes());
  Check(
      late.onsets_detected == kBeats + 1,
      "double after: extra onset detected"
  );
  Check(
      late.doubled == 1 && late.dropped == 0 && late.jittered == 0,
      "double after: only the double"
  );
  Check(
      late.doubled_at.size() == 1 && Near(
                                         late.doubled_at[0].value_ms,
                                         0.3 * Interval() * 1000.0,
                                         kTightMs
                                     ),
      "double after: reported 0.3 beat after its beat's click"
  );
  auto before = GridTimes();
  before.push_back(GridTimes()[9] - (0.3 * Interval()));
  std::sort(before.begin(), before.end());
  const Report early = Classify(Synthesize(before, 1.0, kRate), GridTimes());
  Check(
      early.doubled == 1 && early.dropped == 0 && early.jittered == 0,
      "double before: only the double"
  );
}

void TestOffset() {
  std::vector<double> late = GridTimes();
  for (double& t : late) t += 0.008;
  const Report shifted = Classify(Synthesize(late, 1.0, kRate), GridTimes());
  Check(
      Near(shifted.offset_mean_ms, 8.0, kTightMs),
      "offset 8 ms: mean offset 8 ms"
  );
  Check(
      Near(shifted.offset_max_abs_ms, 8.0, kTightMs),
      "offset 8 ms: max offset 8 ms"
  );
  ExpectNoFaults(shifted, "offset 8 ms: intervals clean");
  Check(
      shifted.error_max_abs_ms <= kTightMs,
      "offset 8 ms: interval error within 1.5 samples"
  );
  Check(
      ThresholdFailures(shifted).size() == 1,
      "offset 8 ms: fails on offset only"
  );
  for (double& t : late) t -= 0.005;
  const Report inside = Classify(Synthesize(late, 1.0, kRate), GridTimes());
  Check(
      Near(inside.offset_mean_ms, 3.0, kTightMs),
      "offset 3 ms: mean offset 3 ms"
  );
  Check(ThresholdFailures(inside).empty(), "offset 3 ms: within the limit");
}

}  // namespace

void RunClassifyTests() {
  TestPerfect();
  TestJittered();
  TestJitterTolerance();
  TestMissing();
  TestDoubled();
  TestOffset();
}

}  // namespace soak_test
