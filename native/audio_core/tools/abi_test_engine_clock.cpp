#include "kitbag_api.h"

#include "abi_test_engine_clock.h"

#include <time.h>

#include <chrono>
#include <cstdint>
#include <vector>

#include "check.h"
#include "media/streaming_track.h"

namespace abi_test {
namespace {

using kitbag_test::Check;

constexpr uint32_t kChannels = 2;
constexpr uint32_t kOddTail = 37;
constexpr uint32_t kBlockFrames[] = {
    480,
    313,
    kitbag::StreamingTrack::kMaxBlockFrames + kOddTail,
    1021,
};

int64_t MonotonicNs() {
  timespec now{};
  clock_gettime(CLOCK_MONOTONIC, &now);
  return (std::chrono::seconds(now.tv_sec) +
          std::chrono::nanoseconds(now.tv_nsec))
      .count();
}

void Render(kb_engine* engine, uint32_t frames) {
  std::vector<float> out(static_cast<size_t>(frames) * kChannels);
  kb_engine_render(engine, out.data(), frames);
}

void TestNoPairBeforeFirstRender(const kb_engine* engine) {
  int64_t frame = 0;
  int64_t ns = 0;
  Check(
      kb_engine_clock_pair(engine, &frame, &ns) == KB_ERROR_BUSY,
      "clock: no pair before the first render"
  );
}

void TestPairTracksEachBlockStart(kb_engine* engine) {
  bool starts_match = true;
  bool within_render = true;
  bool non_decreasing = true;
  int64_t previous_ns = 0;
  for (const uint32_t block : kBlockFrames) {
    const auto block_start =
        static_cast<int64_t>(kb_engine_frames_rendered(engine));
    const int64_t before_ns = MonotonicNs();
    Render(engine, block);
    const int64_t after_ns = MonotonicNs();
    int64_t frame = -1;
    int64_t ns = -1;
    starts_match &= kb_engine_clock_pair(engine, &frame, &ns) == KB_OK &&
                    frame == block_start;
    within_render &= ns >= before_ns && ns <= after_ns;
    non_decreasing &= ns >= previous_ns;
    previous_ns = ns;
  }
  Check(
      starts_match,
      "clock: the pair's frame is the last callback's first frame"
  );
  Check(
      within_render,
      "clock: the pair's time is CLOCK_MONOTONIC during that render"
  );
  Check(non_decreasing, "clock: the pair's time never goes backwards");
}

void TestStopClearsPair(kb_engine* engine) {
  kb_engine_stop(engine);
  int64_t frame = 0;
  int64_t ns = 0;
  Check(
      kb_engine_clock_pair(engine, &frame, &ns) == KB_ERROR_BUSY,
      "clock: stop clears the pair"
  );
  const auto block_start =
      static_cast<int64_t>(kb_engine_frames_rendered(engine));
  Render(engine, kBlockFrames[0]);
  Check(
      kb_engine_clock_pair(engine, &frame, &ns) == KB_OK &&
          frame == block_start,
      "clock: the next render after a stop publishes again"
  );
}

void TestNullArguments(const kb_engine* engine) {
  int64_t frame = 0;
  int64_t ns = 0;
  Check(
      kb_engine_clock_pair(nullptr, &frame, &ns) == KB_ERROR_INVALID_ARGUMENT &&
          kb_engine_clock_pair(engine, nullptr, &ns) ==
              KB_ERROR_INVALID_ARGUMENT &&
          kb_engine_clock_pair(engine, &frame, nullptr) ==
              KB_ERROR_INVALID_ARGUMENT,
      "clock: null engine or outputs are rejected"
  );
}

}  // namespace

void RunEngineClockAbiTests() {
  kb_engine* engine = nullptr;
  Check(kb_engine_create(&engine) == KB_OK, "clock: an engine is created");
  if (engine == nullptr) return;
  TestNoPairBeforeFirstRender(engine);
  TestPairTracksEachBlockStart(engine);
  TestStopClearsPair(engine);
  TestNullArguments(engine);
  kb_engine_destroy(engine);
}

}  // namespace abi_test
