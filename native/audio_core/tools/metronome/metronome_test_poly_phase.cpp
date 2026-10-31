#include "metronome_test_poly_model.h"

namespace metronome_test {
namespace {

constexpr double kPhaseTolerance = 1e-12;
constexpr double kOneThird = 1.0 / 3.0;
constexpr double kTwoThirds = 2.0 / 3.0;
constexpr int64_t kBeatFrames = kSampleRate / 2;
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
  StartPolyOnly(metronome, {5, 3, 4, 4, 120.0});
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
  ConfigurePolyOnly(metronome, {5, 3, 4, 4, 120.0});
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
  StartPolyOnly(metronome, {5, 3, 4, 4, 120.0});
  constexpr int64_t kAfterTickOne = 60 * static_cast<int64_t>(kBlockFrames);
  int32_t before = 0;
  int32_t reset = 0;
  const auto on_block = [&](int64_t at) {
    if (at == kAfterTickOne) {
      before = metronome.current_poly_beat();
      metronome.SetPolyAgainst(2);
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

}  // namespace

void RunPolyPhaseTests() {
  TestFiveThreeAcrossBars();
  TestAcrossMeterChange();
  TestNoPhaseWithoutACycle();
  TestBeatResetsWhenAgainstChanges();
}

}  // namespace metronome_test
