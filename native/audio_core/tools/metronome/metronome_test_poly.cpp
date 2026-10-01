#include "metronome_test_support.h"

namespace metronome_test {
namespace {

using kitbag::Accent;

constexpr int64_t kBarFrames = 96000;
constexpr int64_t kThirdFrames = kBarFrames / 3;
constexpr int64_t kFifthFrames = kBarFrames / 5;
constexpr int64_t kQuarterFrames = kBarFrames / 4;
constexpr int64_t kSixteenthFrames = kBarFrames / 16;
constexpr int64_t kPeakWindow = 480;
constexpr double kPolyAccentPeak = 0.8;
constexpr double kPolyNormalPeak = 0.5;
constexpr double kMainAccentPeak = 0.9;
constexpr double kMainNormalPeak = 0.6;
constexpr double kPeakTolerance = 0.05;
constexpr double kSilentCeiling = 0.1;

struct PolyRun {
  std::vector<float> left;
  std::vector<int32_t> poly_beat_after_block;
};

template <typename OnBlock>
PolyRun RenderPoly(
    kitbag::Metronome& metronome,
    int64_t total_frames,
    OnBlock on_block
) {
  PolyRun run;
  std::vector<float> buffer(static_cast<size_t>(kBlockFrames) * kChannels);
  for (int64_t rendered = 0; rendered < total_frames;
       rendered += kBlockFrames) {
    on_block(rendered);
    std::fill(buffer.begin(), buffer.end(), 0.0f);
    metronome.Render(
        buffer.data(),
        kBlockFrames,
        kSampleRate,
        kChannels,
        static_cast<uint64_t>(rendered)
    );
    for (uint32_t frame = 0; frame < kBlockFrames; ++frame) {
      run.left.push_back(buffer[static_cast<size_t>(frame) * kChannels]);
    }
    run.poly_beat_after_block.push_back(metronome.current_poly_beat());
  }
  return run;
}

PolyRun RenderPoly(kitbag::Metronome& metronome, int64_t total_frames) {
  return RenderPoly(metronome, total_frames, [](int64_t) {});
}

double PeakAt(const PolyRun& run, int64_t frame) {
  double peak = 0.0;
  for (int64_t i = frame; i < frame + kPeakWindow; ++i) {
    peak = std::max(peak, std::fabs(static_cast<double>(run.left[i])));
  }
  return peak;
}

bool Near(double actual, double expected) {
  return std::fabs(actual - expected) <= kPeakTolerance;
}

int32_t PolyBeatAfterBlockEnding(const PolyRun& run, int64_t end_frame) {
  return run.poly_beat_after_block[(end_frame / kBlockFrames) - 1];
}

void StartFourFour(kitbag::Metronome& metronome, int poly_beats) {
  metronome.SetTempo(120.0);
  metronome.SetTimeSignature(4, 4);
  metronome.SetPolyrhythm(true, poly_beats);
  metronome.Start();
}

void MuteMainRow(kitbag::Metronome& metronome) {
  for (int beat = 0; beat < 4; ++beat) {
    metronome.SetAccent(beat, Accent::kMuted);
  }
}

void TestPolyAccentsIndependentOfMain() {
  kitbag::Metronome metronome;
  metronome.SetAccent(1, Accent::kMuted);
  metronome.SetPolyAccent(1, Accent::kAccented);
  metronome.SetPolyAccent(2, Accent::kMuted);
  StartFourFour(metronome, 3);
  const PolyRun run = RenderPoly(metronome, kBarFrames + kBlockFrames);

  Check(
      Near(PeakAt(run, kThirdFrames), kPolyAccentPeak),
      "poly accents: poly slot 1 accented while main slot 1 is muted"
  );
  Check(
      PeakAt(run, 2 * kThirdFrames) < kSilentCeiling,
      "poly accents: muted poly slot 2 is silent"
  );
  Check(
      PeakAt(run, kQuarterFrames) < kSilentCeiling,
      "poly accents: main slot 1 stays muted after a poly slot 1 edit"
  );
  Check(
      Near(PeakAt(run, 2 * kQuarterFrames), kMainNormalPeak),
      "poly accents: main slot 2 stays normal after a poly slot 2 mute"
  );
}

void TestPolyAccentDefaults() {
  kitbag::Metronome metronome;
  MuteMainRow(metronome);
  StartFourFour(metronome, 3);
  const PolyRun run = RenderPoly(metronome, kBarFrames);

  Check(
      Near(PeakAt(run, 0), kPolyAccentPeak),
      "poly defaults: slot 0 starts accented"
  );
  Check(
      Near(PeakAt(run, kThirdFrames), kPolyNormalPeak) &&
          Near(PeakAt(run, 2 * kThirdFrames), kPolyNormalPeak),
      "poly defaults: slots 1 and 2 start normal"
  );
}

void TestPolyResizePreservesAndInitialises() {
  kitbag::Metronome metronome;
  MuteMainRow(metronome);
  metronome.SetPolyrhythm(true, 3);
  metronome.SetPolyAccent(1, Accent::kMuted);
  metronome.SetPolyAccent(2, Accent::kMuted);
  metronome.SetPolyrhythm(true, 2);
  StartFourFour(metronome, 5);
  const PolyRun run = RenderPoly(metronome, kBarFrames);

  Check(
      Near(PeakAt(run, 0), kPolyAccentPeak),
      "poly resize: slot 0 keeps its accent"
  );
  Check(
      PeakAt(run, kFifthFrames) < kSilentCeiling,
      "poly resize: slot 1 kept across shrink and grow stays muted"
  );
  Check(
      Near(PeakAt(run, 2 * kFifthFrames), kPolyNormalPeak),
      "poly resize: slot 2 dropped by the shrink comes back normal"
  );
  Check(
      Near(PeakAt(run, 3 * kFifthFrames), kPolyNormalPeak) &&
          Near(PeakAt(run, 4 * kFifthFrames), kPolyNormalPeak),
      "poly resize: never-used slots 3 and 4 initialise normal"
  );
}

void ExpectDisabledBar(const PolyRun& run) {
  bool all_sentinel = true;
  double peak = 0.0;
  for (int64_t end = kBarFrames + kBlockFrames; end <= 2 * kBarFrames;
       end += kBlockFrames) {
    all_sentinel = all_sentinel && PolyBeatAfterBlockEnding(run, end) == -1;
    peak = std::max(peak, PeakAt(run, end - kPeakWindow));
  }
  Check(all_sentinel, "poly toggle: disabled poly publishes -1 every block");
  Check(peak < kSilentCeiling, "poly toggle: disabled poly is silent");
}

void TestPolyEnableDisable() {
  kitbag::Metronome metronome;
  MuteMainRow(metronome);
  metronome.SetPolyAccent(1, Accent::kMuted);
  StartFourFour(metronome, 3);
  const PolyRun run = RenderPoly(metronome, 3 * kBarFrames, [&](int64_t at) {
    if (at == kBarFrames) metronome.SetPolyrhythm(false, 3);
    if (at == 2 * kBarFrames) metronome.SetPolyrhythm(true, 3);
  });

  ExpectDisabledBar(run);
  const int64_t bar2 = 2 * kBarFrames;
  Check(
      PeakAt(run, bar2 + kThirdFrames) < kSilentCeiling &&
          Near(PeakAt(run, bar2 + 2 * kThirdFrames), kPolyNormalPeak),
      "poly toggle: re-enabling keeps the poly accents"
  );
  Check(
      PolyBeatAfterBlockEnding(run, bar2 + kThirdFrames + kBlockFrames) == 1,
      "poly toggle: re-enabled poly publishes its beat again"
  );
}

int CountProgressionMismatches(const PolyRun& run, int64_t frames) {
  int mismatches = 0;
  for (int64_t end = kBlockFrames; end <= frames; end += kBlockFrames) {
    const auto expected = static_cast<int32_t>((end - 1) / kFifthFrames % 5);
    if (PolyBeatAfterBlockEnding(run, end) != expected) ++mismatches;
  }
  return mismatches;
}

void TestPolyBeatProgression() {
  kitbag::Metronome metronome;
  Check(
      metronome.current_poly_beat() == -1,
      "poly progression: -1 before any render"
  );
  StartFourFour(metronome, 5);
  const int64_t frames = 2 * kBarFrames;
  const PolyRun run =
      RenderPoly(metronome, frames + kBlockFrames, [&](int64_t at) {
        if (at == frames) metronome.Stop();
      });

  Check(
      CountProgressionMismatches(run, frames) == 0,
      "poly progression: 5-over-4 poly beat tracks every block for two bars"
  );
  Check(
      run.poly_beat_after_block.back() == -1,
      "poly progression: stop publishes -1"
  );
}

void TestPolyResizeWhileRunning() {
  kitbag::Metronome metronome;
  StartFourFour(metronome, 5);
  const int64_t shrink_at = 2 * kBarFrames + 4 * kFifthFrames + kBlockFrames;
  const PolyRun run =
      RenderPoly(metronome, 3 * kBarFrames + kBlockFrames, [&](int64_t at) {
        if (at == shrink_at) metronome.SetPolyrhythm(true, 3);
      });

  Check(
      PolyBeatAfterBlockEnding(run, shrink_at) == 4,
      "poly running resize: at poly beat 4 before the shrink"
  );
  Check(
      PolyBeatAfterBlockEnding(run, shrink_at + kBlockFrames) == -1,
      "poly running resize: out-of-range beat cleared to -1 on shrink"
  );
  Check(
      PolyBeatAfterBlockEnding(run, 3 * kBarFrames + kBlockFrames) == 0,
      "poly running resize: 3-beat cycle resumes on the next bar"
  );
}

void TestPolyGridPublishesSentinel() {
  kitbag::Metronome metronome;
  StartFourFour(metronome, 3);
  const PolyRun run = RenderPoly(metronome, 2 * kBarFrames, [&](int64_t at) {
    if (at == kBarFrames + kThirdFrames + kBlockFrames) {
      metronome.SetGrid(MakeShiftedGrid(16, 0.0, 0.5), at, true);
    }
  });

  Check(
      PolyBeatAfterBlockEnding(run, kBarFrames + kThirdFrames + kBlockFrames) ==
          1,
      "poly grid: poly beat 1 before the grid is set"
  );
  Check(
      run.poly_beat_after_block.back() == -1,
      "poly grid: grid mode publishes -1 for the poly row"
  );
}

void TestMainRowUnchangedByPolyEdits() {
  kitbag::Metronome metronome;
  for (int slot = 0; slot < kitbag::Metronome::kMaxPolyBeats; ++slot) {
    metronome.SetPolyAccent(slot, Accent::kMuted);
  }
  StartFourFour(metronome, 3);
  const PolyRun run = RenderPoly(metronome, kBarFrames);

  Check(
      Near(PeakAt(run, 0), kMainAccentPeak),
      "main row: downbeat stays accented with every poly slot muted"
  );
  Check(
      Near(PeakAt(run, kQuarterFrames), kMainNormalPeak) &&
          Near(PeakAt(run, 3 * kQuarterFrames), kMainNormalPeak),
      "main row: beats 1 and 3 stay normal with every poly slot muted"
  );
  Check(
      PeakAt(run, kThirdFrames) < kSilentCeiling,
      "main row: muted poly slot 1 adds nothing between main beats"
  );
}

void TestMainAccentValuesClamp() {
  kitbag::Metronome metronome;
  metronome.SetAccent(1, 256);
  metronome.SetAccent(2, -1);
  metronome.SetAccent(3, static_cast<int32_t>(Accent::kAccented) + 1);
  metronome.SetTempo(120.0);
  metronome.SetTimeSignature(4, 4);
  metronome.Start();
  const PolyRun run = RenderPoly(metronome, kBarFrames);

  Check(
      Near(PeakAt(run, kQuarterFrames), kMainAccentPeak),
      "main clamp: 256 clamps to accented, not wrapped to muted"
  );
  Check(
      PeakAt(run, 2 * kQuarterFrames) < kSilentCeiling,
      "main clamp: -1 clamps to muted"
  );
  Check(
      Near(PeakAt(run, 3 * kQuarterFrames), kMainAccentPeak),
      "main clamp: ACCENTED+1 clamps to accented"
  );
}

void TestPolyAccentValuesClamp() {
  kitbag::Metronome metronome;
  MuteMainRow(metronome);
  metronome.SetPolyAccent(0, -1);
  metronome.SetPolyAccent(1, 256);
  metronome.SetPolyAccent(2, static_cast<int32_t>(Accent::kAccented) + 1);
  StartFourFour(metronome, 3);
  const PolyRun run = RenderPoly(metronome, kBarFrames);

  Check(PeakAt(run, 0) < kSilentCeiling, "poly clamp: -1 clamps to muted");
  Check(
      Near(PeakAt(run, kThirdFrames), kPolyAccentPeak),
      "poly clamp: 256 clamps to accented, not wrapped to muted"
  );
  Check(
      Near(PeakAt(run, 2 * kThirdFrames), kPolyAccentPeak),
      "poly clamp: ACCENTED+1 clamps to accented"
  );
}

void TestPolyAccentSlotOutOfRange() {
  kitbag::Metronome metronome;
  MuteMainRow(metronome);
  metronome.SetPolyrhythm(true, kitbag::Metronome::kMaxPolyBeats);
  metronome.SetPolyAccent(-1, Accent::kMuted);
  metronome.SetPolyAccent(kitbag::Metronome::kMaxPolyBeats, Accent::kMuted);
  StartFourFour(metronome, kitbag::Metronome::kMaxPolyBeats);
  const PolyRun run = RenderPoly(metronome, kBarFrames);

  Check(
      Near(PeakAt(run, 0), kPolyAccentPeak),
      "poly slot range: slot -1 leaves slot 0 accented"
  );
  Check(
      Near(PeakAt(run, 15 * kSixteenthFrames), kPolyNormalPeak),
      "poly slot range: slot kMaxPolyBeats leaves the last slot normal"
  );
}

}  // namespace

void RunPolyTests() {
  TestPolyAccentsIndependentOfMain();
  TestPolyAccentDefaults();
  TestPolyResizePreservesAndInitialises();
  TestPolyEnableDisable();
  TestPolyBeatProgression();
  TestPolyResizeWhileRunning();
  TestPolyGridPublishesSentinel();
  TestMainRowUnchangedByPolyEdits();
  TestMainAccentValuesClamp();
  TestPolyAccentValuesClamp();
  TestPolyAccentSlotOutOfRange();
}

}  // namespace metronome_test
