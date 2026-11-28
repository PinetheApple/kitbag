#include <cstdint>
#include <cstdlib>
#include <vector>

#include "rt/monotonic_clock.h"
#include "rt_test_support.h"

namespace rt_test {

using kitbag_test::Check;
namespace {

constexpr uint32_t kRate = 48000;
constexpr int64_t kStartNs = 91'234'567'891;
constexpr int64_t kTrueOffsetNs = 7'654'321'987;
constexpr int64_t kReadCostNs = 43;
constexpr int64_t kStallNs = 5'000'017;
constexpr int64_t kNarrowStallNs = 300'011;
constexpr int64_t kOneFrame = 1;
constexpr int kReadsPerBracket = 3;

struct StallingClocks {
  std::vector<int64_t> stall_after_boottime_ns;
  int64_t now = kStartNs;
  size_t bracket = 0;
  int reads = 0;

  int64_t Monotonic() {
    ++reads;
    now += kReadCostNs;
    return now;
  }

  int64_t Boottime() {
    ++reads;
    now += kReadCostNs;
    const int64_t read = now + kTrueOffsetNs;
    if (bracket < stall_after_boottime_ns.size()) {
      now += stall_after_boottime_ns[bracket];
    }
    ++bracket;
    return read;
  }

  int64_t FrameError() {
    const int64_t offset = kitbag::SuspendedNsFrom(
        [this] { return Monotonic(); },
        [this] { return Boottime(); }
    );
    return std::llabs(kitbag::NsToFrames(offset - kTrueOffsetNs, kRate));
  }
};

void TestStallOnFirstReadIsRetried() {
  StallingClocks clocks{.stall_after_boottime_ns = {kStallNs}};
  Check(
      clocks.FrameError() <= kOneFrame,
      "suspended: a stall inside the first bracket stays within one frame"
  );
  Check(
      clocks.reads == 2 * kReadsPerBracket,
      "suspended: the first tight bracket ends the retries"
  );
}

void TestEveryBracketStalledTakesNarrowest() {
  std::vector<int64_t> stall_after_boottime_ns(
      kitbag::kSuspendedBracketAttempts,
      kStallNs
  );
  stall_after_boottime_ns[stall_after_boottime_ns.size() / 2] = kNarrowStallNs;
  StallingClocks clocks{.stall_after_boottime_ns = stall_after_boottime_ns};
  const int64_t narrow_error =
      std::llabs(kitbag::NsToFrames(kNarrowStallNs / 2, kRate));
  Check(
      clocks.FrameError() <= narrow_error + kOneFrame,
      "suspended: with every bracket stalled the narrowest one is used"
  );
  Check(
      clocks.reads == kitbag::kSuspendedBracketAttempts * kReadsPerBracket,
      "suspended: brackets stop at the retry cap"
  );
}

}  // namespace

void RunSuspendedClockTests() {
  TestStallOnFirstReadIsRetried();
  TestEveryBracketStalledTakesNarrowest();
}

}  // namespace rt_test
