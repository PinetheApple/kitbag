#include "kitbag_api.h"

#include <algorithm>
#include <chrono>
#include <cstdint>

#include "abi_test_engine_clock.h"
#include "abi_test_song_rig.h"
#include "check.h"
#include "media/streaming_track.h"

namespace abi_test {
namespace {

using kitbag_test::Check;

constexpr uint32_t kOddTail = 37;
constexpr uint32_t kBlockFrames[] = {
    480,
    313,
    kitbag::StreamingTrack::kMaxBlockFrames + kOddTail,
    1021,
    192,
};
constexpr int kBlockRounds = 60;
constexpr int64_t kProbeDeltas[] = {-7001, 0, 1, 12345, 480000};
constexpr int64_t kLateNs = 10'000'000;
constexpr int64_t kSuspendedToleranceNs = 1'000'000;
constexpr int64_t kHoursSuspendedNs =
    std::chrono::nanoseconds(
        std::chrono::hours(3) + std::chrono::microseconds(123'457)
    )
        .count();

void TestRefusals() {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return;
  int64_t frame = 0;
  const int64_t now = kb_clock_boottime_ns();
  Check(
      kb_engine_frame_at_boottime(engine, now, &frame) == KB_ERROR_BUSY,
      "boottime: no mapping before the first render"
  );
  Check(
      kb_engine_frame_at_boottime(nullptr, now, &frame) ==
              KB_ERROR_INVALID_ARGUMENT &&
          kb_engine_frame_at_boottime(engine, now, nullptr) ==
              KB_ERROR_INVALID_ARGUMENT &&
          kb_engine_frame_at_boottime(engine, -1, &frame) ==
              KB_ERROR_INVALID_ARGUMENT,
      "boottime: null engine or output, or a negative instant, is refused"
  );
  kb_engine_destroy(engine);
}

bool ProbesExact(const SongRig& rig, int64_t block_start) {
  for (const int64_t delta : kProbeDeltas) {
    int64_t frame = 0;
    const int64_t target = block_start + delta;
    if (!rig.FrameAt(static_cast<double>(target), &frame)) return false;
    if (frame != target) return false;
  }
  return true;
}

void TestExactAcrossBlocks() {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return;
  SongRig rig{.engine = engine, .base_ns = kitbag::MonotonicNs()};
  bool exact = true;
  for (int round = 0; round < kBlockRounds; ++round) {
    for (const uint32_t block : kBlockFrames) {
      const int64_t block_start = rig.rendered;
      rig.Render(block);
      exact &= ProbesExact(rig, block_start);
    }
  }
  Check(
      exact,
      "boottime: every instant maps to its exact frame, before, at and after "
      "the latest block, across odd block sizes"
  );
  kb_engine_destroy(engine);
}

void TestClockIsRawBoottime() {
  const int64_t before = RawNs(kRawBoottime);
  const int64_t read = kb_clock_boottime_ns();
  const int64_t after = RawNs(kRawBoottime);
  Check(
      before <= read && read <= after,
      "boottime: kb_clock_boottime_ns reads CLOCK_BOOTTIME"
  );
}

void TestSuspendedIsBoottimeMinusMonotonic() {
  const int64_t before = RawSuspendedNs();
  const int64_t read = kb_clock_suspended_ns();
  const int64_t after = RawSuspendedNs();
  Check(
      read >= 0 && read >= std::min(before, after) - kSuspendedToleranceNs &&
          read <= std::max(before, after) + kSuspendedToleranceNs,
      "boottime: kb_clock_suspended_ns is CLOCK_BOOTTIME minus CLOCK_MONOTONIC"
  );
}

void TestHoursSuspendedSubtracted() {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return;
  kb_engine_set_suspended_ns(engine, kHoursSuspendedNs);
  SongRig rig{
      .engine = engine,
      .base_ns = kitbag::MonotonicNs(),
      .forced_offset_ns = kHoursSuspendedNs,
  };
  bool exact = true;
  for (const uint32_t block : kBlockFrames) {
    const int64_t block_start = rig.rendered;
    rig.Render(block);
    exact &= ProbesExact(rig, block_start);
  }
  Check(
      exact,
      "boottime: hours spent suspended are taken off before the frame is mapped"
  );
  kb_engine_destroy(engine);
}

void TestLatestPairWins() {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return;
  SongRig rig{.engine = engine, .base_ns = kitbag::MonotonicNs()};
  rig.Render(kBlockFrames[0]);
  const int64_t late_block = rig.rendered;
  rig.Render(kBlockFrames[0], kLateNs);
  int64_t frame = 0;
  const int64_t late_frames =
      kitbag::NsToFrames(kLateNs, kb_engine_sample_rate(engine));
  Check(
      rig.FrameAt(static_cast<double>(late_block + late_frames), &frame) &&
          frame == late_block,
      "boottime: a late callback moves the mapping with it"
  );
  kb_engine_destroy(engine);
}

}  // namespace

void RunBoottimeMappingAbiTests() {
  TestRefusals();
  TestExactAcrossBlocks();
  TestLatestPairWins();
  TestClockIsRawBoottime();
  TestSuspendedIsBoottimeMinusMonotonic();
  TestHoursSuspendedSubtracted();
}

}  // namespace abi_test
