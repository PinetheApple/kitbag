#include "metronome_test_poly_model.h"

namespace metronome_test {
namespace {

constexpr PolySetup kFiveThreeAt120{5, 3, 4, 4, 120.0};
constexpr double kPhaseTolerance = 1e-12;
constexpr uint32_t kDownbeatAlignedBlockFrames = 240;
constexpr double kAgreementSeconds = 120.0;
constexpr int64_t kGridFrame = 200 * static_cast<int64_t>(kBlockFrames);
constexpr int64_t kMeterChangeTick = 80 * static_cast<int64_t>(kBlockFrames);
constexpr double kOneThird = 1.0 / 3.0;
constexpr double kTwoThirds = 2.0 / 3.0;
constexpr int64_t kMidBarZero = 2 * kBeatFrames;
constexpr int64_t kMidBarOne = 6 * kBeatFrames;
constexpr int64_t kMidBarTwo = 10 * kBeatFrames;
constexpr int64_t kMidBarThree = 14 * kBeatFrames;
constexpr int kFiveFourBeats = 5;
constexpr int64_t kMeterChangeFrame = 488 * static_cast<int64_t>(kBlockFrames);
constexpr int64_t kFirstFiveFourBar = 6 * kBeatFrames;
constexpr int64_t kSecondFiveFourBar = 11 * kBeatFrames;
constexpr int64_t kPolyOffFrame = 1300 * static_cast<int64_t>(kBlockFrames);

struct PhaseRead {
  int64_t after_frame;
  double expected;
};

template <typename OnBlock>
std::vector<double> ReadPhases(
    kitbag::Metronome& metronome,
    const std::vector<PhaseRead>& reads,
    OnBlock on_block
) {
  std::vector<double> seen(reads.size(), KB_POLY_PHASE_NONE);
  const auto after_block = [&](int64_t end) {
    for (size_t i = 0; i < reads.size(); ++i) {
      if (end - kBlockFrames < reads[i].after_frame &&
          reads[i].after_frame <= end) {
        seen[i] = metronome.poly_downbeat_phase();
      }
    }
  };
  RenderLeft(metronome, reads.back().after_frame + 1, on_block, after_block);
  return seen;
}

void ExpectPhases(
    const std::string& label,
    const std::vector<PhaseRead>& reads,
    const std::vector<double>& seen
) {
  for (size_t i = 0; i < reads.size(); ++i) {
    if (std::fabs(seen[i] - reads[i].expected) <= kPhaseTolerance) continue;
    char what[96];
    std::snprintf(
        what,
        sizeof what,
        "read %zu is %.6f, expected %.6f",
        i,
        seen[i],
        reads[i].expected
    );
    CheckCase(false, label, what);
    return;
  }
  CheckCase(true, label, "");
}

void TestFiveThreeAcrossBars() {
  kitbag::Metronome metronome;
  StartPolyOnly(metronome, kFiveThreeAt120);
  const std::vector<PhaseRead> reads = {
      {kMidBarZero, 0.0},
      {kMidBarOne, kOneThird},
      {kMidBarTwo, kTwoThirds},
      {kMidBarThree, 0.0},
  };
  ExpectPhases(
      "poly downbeat phase: 5:3 in 4/4 over bars 1-4",
      reads,
      ReadPhases(metronome, reads, [](int64_t) {})
  );
}

void ExpectAcrossMeterChange(int against, const std::vector<PhaseRead>& reads) {
  kitbag::Metronome metronome;
  StartPolyOnly(metronome, {5, against, 4, 4, 120.0});
  const auto on_block = [&](int64_t at) {
    if (at == kMeterChangeFrame) metronome.SetTimeSignature(kFiveFourBeats, 4);
  };
  ExpectPhases(
      PolyLabel(
          "poly downbeat phase across 4/4 -> 5/4:",
          {5, against, 4, 4, 120.0}
      ),
      reads,
      ReadPhases(metronome, reads, on_block)
  );
}

void TestAcrossMeterChange() {
  ExpectAcrossMeterChange(
      3,
      {{kMidBarZero, 0.0},
       {kMidBarOne - kBeatFrames, kOneThird},
       {kFirstFiveFourBar, kTwoThirds},
       {kSecondFiveFourBar, kOneThird}}
  );
  ExpectAcrossMeterChange(
      KB_POLY_AGAINST_BAR,
      {{kMidBarZero, 0.0},
       {kMidBarOne - kBeatFrames, 0.0},
       {kFirstFiveFourBar, 0.0},
       {kSecondFiveFourBar, 0.0}}
  );
}

void TestNoPhaseWithoutACycle() {
  kitbag::Metronome metronome;
  ConfigurePolyOnly(metronome, kFiveThreeAt120);
  metronome.SetCountIn(1, false, 0);
  const bool idle = metronome.poly_downbeat_phase() == KB_POLY_PHASE_NONE;
  metronome.Start();
  const std::vector<PhaseRead> reads = {
      {kMidBarZero, KB_POLY_PHASE_NONE},
      {kMidBarTwo, kOneThird},
      {kMidBarThree, KB_POLY_PHASE_NONE},
  };
  const std::vector<double> seen =
      ReadPhases(metronome, reads, [&](int64_t at) {
        if (at == kPolyOffFrame) metronome.SetPolyrhythm(false, 5);
      });
  Check(idle, "poly downbeat phase: none before the first render");
  ExpectPhases(
      "poly downbeat phase: none counting in and with poly off",
      reads,
      seen
  );
}

void TestBeatResetsWhenAgainstChanges() {
  kitbag::Metronome metronome;
  StartPolyOnly(metronome, kFiveThreeAt120);
  constexpr int64_t kAfterTickOne = 60 * static_cast<int64_t>(kBlockFrames);
  int32_t before = 0;
  int32_t reset = 0;
  const auto on_block = [&](int64_t at) {
    if (at == kAfterTickOne) {
      before = metronome.current_poly_beat();
      metronome.SetPolyAgainst(kChangedAgainst);
    }
  };
  const auto after_block = [&](int64_t end) {
    if (end == kAfterTickOne + kBlockFrames) {
      reset = metronome.current_poly_beat();
    }
  };
  RenderLeft(metronome, kAfterTickOne + kBlockFrames, on_block, after_block);
  Check(
      before == 1 && reset == -1,
      "current_poly_beat: -1 after an against change until the next tick"
  );
}

struct AgreementRun {
  double bpm;
  double latency_ms;
};

double ExpectedPhase(int64_t bar) {
  if (bar < 0) return KB_POLY_PHASE_NONE;
  const int64_t downbeat = bar * kFiveThreeAt120.numerator;
  return static_cast<double>(downbeat % kFiveThreeAt120.against) /
         kFiveThreeAt120.against;
}

void StartAgreementRun(kitbag::Metronome& metronome, const AgreementRun& run) {
  PolySetup setup = kFiveThreeAt120;
  setup.bpm = run.bpm;
  ConfigurePolyOnly(metronome, setup);
  metronome.SetLatencyOffset(run.latency_ms);
  metronome.Start();
}

int CountDisagreements(const AgreementRun& run) {
  kitbag::Metronome metronome;
  StartAgreementRun(metronome, run);
  std::vector<float> buffer(
      static_cast<size_t>(kDownbeatAlignedBlockFrames) * kChannels
  );
  int64_t bar = -1;
  int previous = -1;
  int disagreements = 0;
  for (int64_t start = 0; start < FramesFor(kAgreementSeconds);
       start += kDownbeatAlignedBlockFrames) {
    metronome.Render(
        buffer.data(),
        kDownbeatAlignedBlockFrames,
        kSampleRate,
        kChannels,
        static_cast<uint64_t>(start)
    );
    const int beat = metronome.current_beat();
    if (beat == 0 && previous != 0) ++bar;
    previous = beat;
    const double seen = metronome.poly_downbeat_phase();
    if (std::fabs(seen - ExpectedPhase(bar)) > kPhaseTolerance) {
      ++disagreements;
    }
  }
  return disagreements;
}

void TestPhaseAgreesWithCurrentBeat() {
  for (const AgreementRun& run : std::vector<AgreementRun>{
           {60.0, 0.0},
           {120.0, 0.0},
           {150.0, 0.0},
           {120.0, kitbag::Metronome::kMaxLatencyOffsetMs},
       }) {
    char label[96];
    std::snprintf(
        label,
        sizeof label,
        "poly downbeat phase: %.0f BPM, %.0f ms offset, agrees with "
        "current_beat",
        run.bpm,
        run.latency_ms
    );
    char what[64];
    const int disagreements = CountDisagreements(run);
    std::snprintf(what, sizeof what, "%d blocks disagree", disagreements);
    CheckCase(disagreements == 0, label, what);
  }
}

void TestNoPhaseUnderAGrid() {
  kitbag::Metronome metronome;
  StartPolyOnly(metronome, kFiveThreeAt120);
  const std::vector<PhaseRead> reads = {
      {kMidBarZero, 0.0},
      {kMidBarTwo, KB_POLY_PHASE_NONE},
  };
  const auto on_block = [&](int64_t at) {
    if (at == kGridFrame) {
      metronome.SetGrid(MakeShiftedGrid(64, 0.0, 0.5), at, true);
    }
  };
  ExpectPhases(
      "poly downbeat phase: none while a grid is set",
      reads,
      ReadPhases(metronome, reads, on_block)
  );
}

int32_t PolyBeatAfterMeterChange(const PolySetup& setup) {
  kitbag::Metronome metronome;
  StartPolyOnly(metronome, setup);
  int32_t after = 0;
  const auto on_block = [&](int64_t at) {
    if (at == kMeterChangeTick) metronome.SetTimeSignature(3, 4);
  };
  const auto after_block = [&](int64_t end) {
    if (end == kMeterChangeTick + kBlockFrames) {
      after = metronome.current_poly_beat();
    }
  };
  RenderLeft(metronome, kMeterChangeTick + kBlockFrames, on_block, after_block);
  return after;
}

void TestBeatResetsWhenTheFollowedBarChanges() {
  Check(
      PolyBeatAfterMeterChange({5, KB_POLY_AGAINST_BAR, 4, 4, 120.0}) == -1,
      "current_poly_beat: -1 after 4/4 -> 3/4 changes a followed against"
  );
  Check(
      PolyBeatAfterMeterChange(kFiveThreeAt120) == 1,
      "current_poly_beat: kept when a meter change leaves an explicit against"
  );
}

}  // namespace

void RunPolyPhaseTests() {
  TestFiveThreeAcrossBars();
  TestAcrossMeterChange();
  TestNoPhaseWithoutACycle();
  TestBeatResetsWhenAgainstChanges();
  TestPhaseAgreesWithCurrentBeat();
  TestNoPhaseUnderAGrid();
  TestBeatResetsWhenTheFollowedBarChanges();
}

}  // namespace metronome_test
