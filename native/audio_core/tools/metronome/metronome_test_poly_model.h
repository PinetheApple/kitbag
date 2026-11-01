#ifndef KITBAG_TOOLS_METRONOME_METRONOME_TEST_POLY_MODEL_H
#define KITBAG_TOOLS_METRONOME_METRONOME_TEST_POLY_MODEL_H

// Poly ticks modelled from SPEC.md §5.2, not from the engine: tick k of an N:M
// row sits on main beat k*M/N, and every N-th tick starts a cycle.
#include "kitbag_api.h"

#include <limits>
#include <string>

#include "metronome/metronome_internal.h"
#include "metronome_test_audio.h"

namespace metronome_test {

constexpr double kRunSeconds = 30.0;
constexpr double kChangedBpm = 131.0;
constexpr int kChangedAgainst = 2;
constexpr double kPolyAccentPeak = 0.8;
constexpr double kPolyNormalPeak = 0.5;
constexpr int64_t kChangeFrame = 230 * static_cast<int64_t>(kBlockFrames);
constexpr int64_t kPolyOnsetGapFrames = 2 * kRiseWindowFrames;
constexpr double kPolyMinRise = 0.2;
constexpr double kPolyLevelTolerance = 0.15;
constexpr double kPolyModelEpsilon = 1e-9;

// Constant tempo and cycle length from start_beat until the next span.
struct PolySpan {
  double start_beat;
  double start_seconds;
  double seconds_per_beat;
  int against;
};

struct PolyTick {
  int64_t frame;
  bool cycle_start;
};

struct PolyAudit {
  int missing = 0;
  int64_t first_missing = -1;
  int wrong_level = 0;
  int64_t first_wrong_level = -1;
  int onsets = 0;
};

inline double SecondsPerBeat(double bpm, int denominator) {
  return kitbag::metronome_detail::kSecondsPerMinute / bpm *
         kitbag::Metronome::kBpmReferenceDenominator / denominator;
}

inline int64_t PolyAuditLimit(int64_t total_frames) {
  return total_frames - kRiseWindowFrames - kFrameSlack;
}

inline void AppendSpanTicks(
    const PolySpan& span,
    double end_beat,
    int poly_beats,
    int64_t limit,
    std::vector<PolyTick>* ticks
) {
  const double step = static_cast<double>(span.against) / poly_beats;
  auto index = static_cast<int64_t>(
      std::ceil(span.start_beat / step - kPolyModelEpsilon)
  );
  for (;; ++index) {
    const double beat = static_cast<double>(index) * step;
    if (beat >= end_beat) return;
    const double seconds =
        span.start_seconds + (beat - span.start_beat) * span.seconds_per_beat;
    const auto frame = static_cast<int64_t>(std::ceil(seconds * kSampleRate));
    if (frame >= limit) return;
    if (frame >= 0) ticks->push_back({frame, index % poly_beats == 0});
  }
}

inline std::vector<PolyTick> ModelPolyTicks(
    const std::vector<PolySpan>& spans,
    int poly_beats,
    int64_t total_frames
) {
  std::vector<PolyTick> ticks;
  for (size_t i = 0; i < spans.size(); ++i) {
    const double end_beat = i + 1 < spans.size()
                                ? spans[i + 1].start_beat
                                : std::numeric_limits<double>::infinity();
    AppendSpanTicks(
        spans[i],
        end_beat,
        poly_beats,
        PolyAuditLimit(total_frames),
        &ticks
    );
  }
  return ticks;
}

// The engine applies a block-boundary command at `frame`; the beat clock keeps
// its position and only the tempo or the cycle length changes from there.
inline PolySpan
SpanFrom(const PolySpan& before, int64_t frame, double spb, int against) {
  const double seconds = static_cast<double>(frame) / kSampleRate;
  const double beat = before.start_beat + (seconds - before.start_seconds) /
                                              before.seconds_per_beat;
  return {beat, seconds, spb, against};
}

inline double RiseAt(const std::vector<float>& left, int64_t frame) {
  return PeakOver(left, frame, frame + kRiseWindowFrames) -
         PeakOver(left, frame - kRiseWindowFrames, frame);
}

inline int
CountPolyOnsets(const std::vector<float>& left, int64_t from, int64_t limit) {
  int onsets = 0;
  int64_t next_allowed = from;
  for (int64_t frame = from; frame < limit; ++frame) {
    if (frame < next_allowed || RiseAt(left, frame) < kPolyMinRise) continue;
    ++onsets;
    next_allowed = frame + kPolyOnsetGapFrames;
  }
  return onsets;
}

inline void AuditTick(
    const std::vector<float>& left,
    const PolyTick& tick,
    PolyAudit* audit
) {
  const int64_t from = tick.frame - kFrameSlack;
  const double before = PeakOver(left, from - kRiseWindowFrames, from);
  const double after = PeakOver(left, from, tick.frame + kRiseWindowFrames);
  if (after - before < kPolyMinRise) {
    if (audit->missing++ == 0) audit->first_missing = tick.frame;
    return;
  }
  const double want = tick.cycle_start ? kPolyAccentPeak : kPolyNormalPeak;
  if (std::fabs(after - want) > kPolyLevelTolerance) {
    if (audit->wrong_level++ == 0) audit->first_wrong_level = tick.frame;
  }
}

inline void ExpectPolyTicks(
    const std::string& label,
    const std::vector<PolyTick>& model,
    const std::vector<float>& left,
    int64_t first_poly_frame = 0
) {
  PolyAudit audit;
  for (const PolyTick& tick : model) AuditTick(left, tick, &audit);
  const auto total = static_cast<int64_t>(left.size());
  audit.onsets = CountPolyOnsets(left, first_poly_frame, PolyAuditLimit(total));
  char what[128];
  std::snprintf(
      what,
      sizeof what,
      "%d model ticks silent, first at frame %lld",
      audit.missing,
      static_cast<long long>(audit.first_missing)
  );
  CheckCase(audit.missing == 0, label, what);
  std::snprintf(
      what,
      sizeof what,
      "%d ticks at the wrong level (doubled or wrong cycle slot), first %lld",
      audit.wrong_level,
      static_cast<long long>(audit.first_wrong_level)
  );
  CheckCase(audit.wrong_level == 0, label, what);
  std::snprintf(
      what,
      sizeof what,
      "%d onsets, model has %zu",
      audit.onsets,
      model.size()
  );
  CheckCase(audit.onsets == static_cast<int>(model.size()), label, what);
}

inline void MuteMainBeats(kitbag::Metronome& metronome, int beats_per_bar) {
  for (int beat = 0; beat < beats_per_bar; ++beat) {
    metronome.SetAccent(beat, kitbag::Accent::kMuted);
  }
}

struct PolySetup {
  int poly;
  int against;
  int numerator;
  int denominator;
  double bpm;
};

inline int EffectiveAgainst(int against, int numerator) {
  return against == KB_POLY_AGAINST_BAR ? numerator : against;
}

inline std::string PolyLabel(const char* what, const PolySetup& setup) {
  char text[128];
  char against[16];
  if (setup.against == KB_POLY_AGAINST_BAR) {
    std::snprintf(against, sizeof against, "bar");
  } else {
    std::snprintf(against, sizeof against, "%d", setup.against);
  }
  std::snprintf(
      text,
      sizeof text,
      "%s %d:%s in %d/%d at %.0f BPM",
      what,
      setup.poly,
      against,
      setup.numerator,
      setup.denominator,
      setup.bpm
  );
  return text;
}

inline void
ConfigurePolyOnly(kitbag::Metronome& metronome, const PolySetup& setup) {
  metronome.SetTempo(setup.bpm);
  metronome.SetTimeSignature(setup.numerator, setup.denominator);
  metronome.SetSounds(kClickSound, kClickSound);
  metronome.SetPolyrhythm(true, setup.poly);
  metronome.SetPolyAgainst(setup.against);
  MuteMainBeats(metronome, setup.numerator);
}

inline void
StartPolyOnly(kitbag::Metronome& metronome, const PolySetup& setup) {
  ConfigurePolyOnly(metronome, setup);
  metronome.Start();
}

inline PolySpan FirstSpan(const PolySetup& setup) {
  return {
      0.0,
      0.0,
      SecondsPerBeat(setup.bpm, setup.denominator),
      EffectiveAgainst(setup.against, setup.numerator)
  };
}

}  // namespace metronome_test

#endif  // KITBAG_TOOLS_METRONOME_METRONOME_TEST_POLY_MODEL_H
