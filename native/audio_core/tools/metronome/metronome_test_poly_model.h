#ifndef KITBAG_TOOLS_METRONOME_METRONOME_TEST_POLY_MODEL_H
#define KITBAG_TOOLS_METRONOME_METRONOME_TEST_POLY_MODEL_H

// Poly ticks modelled from SPEC.md §5.2, not from the engine: tick k of an N:M
// row sits on main beat k*M/N, and every N-th tick starts a cycle.
#include "kitbag_api.h"

#include <limits>
#include <string>

#include "metronome/metronome_internal.h"
#include "metronome_test_support.h"

namespace metronome_test {

constexpr int kPolyHihat = 4;
constexpr int64_t kPolyRiseFrames = 32;
constexpr int64_t kPolyFrameSlack = 2;
constexpr int64_t kPolyOnsetGapFrames = 2 * kPolyRiseFrames;
constexpr double kPolyMinRise = 0.2;
constexpr double kPolyLevelTolerance = 0.15;
constexpr double kPolyCycleStartLevel = 0.8;
constexpr double kPolyBeatLevel = 0.5;
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
  return total_frames - kPolyRiseFrames - kPolyFrameSlack;
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
    ticks->push_back({frame, index % poly_beats == 0});
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

inline double PeakOver(const std::vector<float>& left, int64_t lo, int64_t hi) {
  double peak = 0.0;
  for (int64_t i = std::max<int64_t>(lo, 0);
       i < std::min<int64_t>(hi, static_cast<int64_t>(left.size()));
       ++i) {
    peak = std::max(peak, std::fabs(static_cast<double>(left[i])));
  }
  return peak;
}

inline double RiseAt(const std::vector<float>& left, int64_t frame) {
  return PeakOver(left, frame, frame + kPolyRiseFrames) -
         PeakOver(left, frame - kPolyRiseFrames, frame);
}

inline int CountPolyOnsets(const std::vector<float>& left, int64_t limit) {
  int onsets = 0;
  int64_t next_allowed = 0;
  for (int64_t frame = 0; frame < limit; ++frame) {
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
  const int64_t from = tick.frame - kPolyFrameSlack;
  const double before = PeakOver(left, from - kPolyRiseFrames, from);
  const double after = PeakOver(left, from, tick.frame + kPolyRiseFrames);
  if (after - before < kPolyMinRise) {
    if (audit->missing++ == 0) audit->first_missing = tick.frame;
    return;
  }
  const double want = tick.cycle_start ? kPolyCycleStartLevel : kPolyBeatLevel;
  if (std::fabs(after - want) > kPolyLevelTolerance) {
    if (audit->wrong_level++ == 0) audit->first_wrong_level = tick.frame;
  }
}

inline PolyAudit AuditPoly(
    const std::vector<float>& left,
    const std::vector<PolyTick>& ticks,
    int64_t total_frames
) {
  PolyAudit audit;
  for (const PolyTick& tick : ticks) AuditTick(left, tick, &audit);
  audit.onsets = CountPolyOnsets(left, PolyAuditLimit(total_frames));
  return audit;
}

inline void CheckPoly(bool passed, const std::string& label, const char* what) {
  if (!passed) std::fprintf(stderr, "  %s: %s\n", label.c_str(), what);
  Check(passed, label.c_str());
}

inline void ExpectPolyTicks(
    const std::string& label,
    const std::vector<PolyTick>& model,
    const std::vector<float>& left
) {
  const PolyAudit audit =
      AuditPoly(left, model, static_cast<int64_t>(left.size()));
  char what[128];
  std::snprintf(
      what,
      sizeof what,
      "%d model ticks silent, first at frame %lld",
      audit.missing,
      static_cast<long long>(audit.first_missing)
  );
  CheckPoly(audit.missing == 0, label, what);
  std::snprintf(
      what,
      sizeof what,
      "%d ticks at the wrong level (doubled or wrong cycle slot), first %lld",
      audit.wrong_level,
      static_cast<long long>(audit.first_wrong_level)
  );
  CheckPoly(audit.wrong_level == 0, label, what);
  std::snprintf(
      what,
      sizeof what,
      "%d onsets, model has %zu",
      audit.onsets,
      model.size()
  );
  CheckPoly(audit.onsets == static_cast<int>(model.size()), label, what);
}

template <typename OnBlock>
std::vector<float> RenderPolyLeft(
    kitbag::Metronome& metronome,
    int64_t total_frames,
    OnBlock on_block
) {
  std::vector<float> left;
  std::vector<float> buffer(static_cast<size_t>(kBlockFrames) * kChannels);
  for (int64_t start = 0; start < total_frames; start += kBlockFrames) {
    on_block(start);
    std::fill(buffer.begin(), buffer.end(), 0.0f);
    metronome.Render(
        buffer.data(),
        kBlockFrames,
        kSampleRate,
        kChannels,
        static_cast<uint64_t>(start)
    );
    for (uint32_t frame = 0; frame < kBlockFrames; ++frame) {
      left.push_back(buffer[static_cast<size_t>(frame) * kChannels]);
    }
  }
  return left;
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
  metronome.SetSounds(kPolyHihat, kPolyHihat);
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
