#include "kitbag_api.h"

#include <cstdint>
#include <limits>
#include <vector>

#include "check.h"
#include "constant_tempo_fixtures.h"

namespace beat_tracker_test {

namespace {

using kitbag_test::Check;

constexpr int kBeats = 16;
constexpr float kGapSec = 0.5f;

struct Call {
  const char* name;
  const float* beats;
  int32_t beat_count;
  const int32_t* downbeats;
  int32_t downbeat_count;
};

Fit Run(const Call& call) {
  return RunFit(
      call.beats,
      call.beat_count,
      call.downbeats,
      call.downbeat_count
  );
}

void CheckRejected(const Call& call) {
  const Fit out = Run(call);
  Check(
      out.status == KB_ERROR_INVALID_ARGUMENT && out.bpm == 0.0f &&
          out.anchor == 0.0 && out.beats_per_bar == 0,
      call.name
  );
}

std::vector<float> Spaced(float gap_sec, int count) {
  std::vector<float> beats;
  for (int k = 0; k < count; ++k) {
    beats.push_back(static_cast<float>(k) * gap_sec);
  }
  return beats;
}

constexpr int kMid = kBeats / 2;

struct BeatFault {
  const char* name;
  int index;
  float value;
};

void TestBadBeatValues() {
  const std::vector<float> good = Spaced(kGapSec, kBeats);
  const BeatFault faults[] = {
      {"error: a NaN beat reads 0",
       kMid,
       std::numeric_limits<float>::quiet_NaN()},
      {"error: an infinite beat reads 0",
       kBeats - 1,
       std::numeric_limits<float>::infinity()},
      {"error: a beat that does not ascend reads 0", kMid, good[kMid - 1]},
  };
  for (const BeatFault& fault : faults) {
    std::vector<float> beats = good;
    beats[fault.index] = fault.value;
    CheckRejected({fault.name, beats.data(), kBeats, nullptr, 0});
  }
}

void TestBadBeatCounts() {
  const std::vector<float> over = Spaced(kGapSec, KB_MAX_GRID_BEATS + 1);
  const Call calls[] = {
      {"error: null beats read 0", nullptr, kBeats, nullptr, 0},
      {"error: a negative beat count reads 0", over.data(), -1, nullptr, 0},
      {"error: one beat reads 0", over.data(), 1, nullptr, 0},
      {"error: more than KB_MAX_GRID_BEATS reads 0",
       over.data(),
       KB_MAX_GRID_BEATS + 1,
       nullptr,
       0},
  };
  for (const Call& call : calls) CheckRejected(call);
}

struct DownbeatFault {
  const char* name;
  std::vector<int32_t> indices;
  int32_t count;
};

void TestBadDownbeats() {
  const std::vector<float> good = Spaced(kGapSec, kBeats);
  const DownbeatFault faults[] = {
      {"error: a negative downbeat count reads 0", {0}, -1},
      {"error: null downbeats with a count read 0", {}, 1},
      {"error: a downbeat before the beats reads 0", {0, -1}, 2},
      {"error: a downbeat past the beats reads 0", {0, kBeats}, 2},
      {"error: more downbeats than beats read 0",
       std::vector<int32_t>(kBeats + 1, 0),
       kBeats + 1},
  };
  for (const DownbeatFault& fault : faults) {
    const int32_t* indices =
        fault.indices.empty() ? nullptr : fault.indices.data();
    CheckRejected({fault.name, good.data(), kBeats, indices, fault.count});
  }
}

struct NullOutput {
  const char* name;
  bool bpm;
  bool anchor;
  bool beats_per_bar;
};

void TestNullOutputs() {
  const std::vector<float> good = Spaced(kGapSec, kBeats);
  const NullOutput cases[] = {
      {"error: a null bpm output zeroes the others", true, false, false},
      {"error: a null anchor output zeroes the others", false, true, false},
      {"error: a null beats-per-bar output zeroes the others",
       false,
       false,
       true},
  };
  for (const NullOutput& null_case : cases) {
    Fit out;
    const kb_result status = kb_fit_constant_tempo(
        good.data(),
        kBeats,
        nullptr,
        0,
        null_case.bpm ? nullptr : &out.bpm,
        null_case.anchor ? nullptr : &out.anchor,
        null_case.beats_per_bar ? nullptr : &out.beats_per_bar
    );
    Check(
        status == KB_ERROR_INVALID_ARGUMENT &&
            (null_case.bpm || out.bpm == 0.0f) &&
            (null_case.anchor || out.anchor == 0.0) &&
            (null_case.beats_per_bar || out.beats_per_bar == 0),
        null_case.name
    );
  }
}

constexpr float kSlowestGapSec = 2.0f;
constexpr float kTooSlowGapSec = 2.1f;
constexpr float kFastGapSec = 0.21f;
constexpr float kTooFastGapSec = 0.19f;

bool Accepts(float gap_sec) {
  const std::vector<float> beats = Spaced(gap_sec, kBeats);
  return Run({"", beats.data(), kBeats, nullptr, 0}).status == KB_OK;
}

}  // namespace

void RunErrorTests() {
  TestBadBeatValues();
  TestBadBeatCounts();
  TestBadDownbeats();
  TestNullOutputs();
}

void RunLimitTests() {
  Check(Accepts(kSlowestGapSec), "limits: 30 bpm, the slowest, fits");
  Check(Accepts(kFastGapSec), "limits: 285.7 bpm fits");
  const std::vector<float> slow = Spaced(kTooSlowGapSec, kBeats);
  CheckRejected({"limits: 28.6 bpm reads 0", slow.data(), kBeats, nullptr, 0});
  const std::vector<float> fast = Spaced(kTooFastGapSec, kBeats);
  CheckRejected({"limits: 315.8 bpm reads 0", fast.data(), kBeats, nullptr, 0});
}

}  // namespace beat_tracker_test
