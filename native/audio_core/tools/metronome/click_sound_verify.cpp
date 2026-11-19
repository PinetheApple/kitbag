#include "kitbag_api.h"

#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdio>
#include <thread>
#include <vector>

#include "click_sound_test_support.h"
#include "counting_allocator.h"
#include "metronome/custom_sound_limits.h"
#include "metronome/sample_voices.h"
#include "rt/rt_publisher.h"

constexpr int kExpectedChecks = 83;

namespace click_sound_test {

using kitbag::SampleVoices;
using kitbag_test::Check;

namespace {

constexpr uint32_t kRaceBlock = 64;
constexpr int kRacePublishes = 3000;
constexpr int kTriggerStride = 7;
constexpr float kRaceLevel = 0.5F;
constexpr size_t kRaceMinFrames = 300;
constexpr size_t kRaceFrameSpread = 4000;
constexpr float kRaceReach =
    (kRaceLevel + SampleVoices::kMaxTail) * SampleVoices::kMaxVoices;

constexpr uint64_t kGrace =
    kitbag::RtPublisher<SampleVoices::Sample>::kReclaimGraceFrames;

struct RaceState {
  SampleVoices voices;
  std::atomic<uint64_t> clock{0};
  std::atomic<bool> done{false};
  bool bounded = true;
  std::vector<uint64_t> retired_at_frames;
  uint64_t last_publish_entered = 0;
};

uint64_t RenderLoop(RaceState* state) {
  uint64_t blocks = 0;
  while (!state->done.load(std::memory_order_acquire)) {
    state->voices.BeginBlock();
    for (uint32_t i = 0; i < kRaceBlock; ++i) {
      const int slot = static_cast<int>(i) % kitbag::kCustomSoundSlots;
      if (i % kTriggerStride == 0) state->voices.Trigger(slot, 1.0F);
      const float sample = state->voices.Render();
      state->bounded = state->bounded && std::isfinite(sample) &&
                       std::fabs(sample) <= kRaceReach;
    }
    state->clock.fetch_add(kRaceBlock, std::memory_order_seq_cst);
    ++blocks;
  }
  return blocks;
}

// Paced on the render clock, one block apart, so the run spans many grace
// windows however the two threads are scheduled.
void PublishLoop(RaceState* state) {
  for (int publish = 0; publish < kRacePublishes; ++publish) {
    const uint64_t due = static_cast<uint64_t>(publish) * kRaceBlock;
    while (state->clock.load(std::memory_order_relaxed) < due) {
      std::this_thread::yield();
    }
    const kitbag::FrameClock clock = kitbag::FrameClock::Reading(state->clock);
    state->last_publish_entered = clock.Now();
    const int slot = publish % kitbag::kCustomSoundSlots;
    if (publish % kTriggerStride == 0) {
      state->voices.Clear(slot, clock, true);
    } else {
      const size_t frames =
          kRaceMinFrames +
          (static_cast<size_t>(publish) * 131) % kRaceFrameSpread;
      state->voices
          .Publish(slot, std::vector<float>(frames, kRaceLevel), clock, true);
    }
    state->retired_at_frames.push_back(clock.Now());
  }
  state->done.store(true, std::memory_order_release);
}

size_t StillInGrace(const std::vector<uint64_t>& frames, uint64_t now) {
  return static_cast<size_t>(
      std::count_if(frames.begin(), frames.end(), [now](uint64_t frame) {
        return now <= frame + kGrace;
      })
  );
}

void TestLoadWhileRendering() {
  RaceState state;
  uint64_t blocks = 0;
  std::thread render([&state, &blocks] { blocks = RenderLoop(&state); });
  PublishLoop(&state);
  render.join();
  const uint64_t first = state.retired_at_frames.front();
  const uint64_t last = state.last_publish_entered;
  const size_t in_grace = StillInGrace(state.retired_at_frames, last);
  std::printf(
      "  race: %d publishes over %llu blocks, %zu retired, %zu in grace\n",
      kRacePublishes,
      static_cast<unsigned long long>(blocks),
      state.voices.retired_size(),
      in_grace
  );
  Check(
      state.bounded,
      "race: every rendered sample is finite and within the pool's reach"
  );
  Check(
      last > first + kGrace,
      "race: the clock ran past a grace window while publishing"
  );
  Check(
      state.voices.retired_size() <= in_grace,
      "race: only sounds retired within the last grace window are still held"
  );
}

void TestAbiLoad(kb_engine* engine, const std::string& in) {
  Check(
      kb_metronome_load_custom_sound(
          engine,
          kitbag::kCustomSoundSlots,
          in.c_str()
      ) == KB_ERROR_INVALID_ARGUMENT,
      "abi: a slot out of range is refused"
  );
  Check(
      kb_metronome_load_custom_sound(engine, 1, in.c_str()) == KB_OK,
      "abi: a sound loads into slot 1"
  );
  Check(
      kb_metronome_custom_sound_loaded(engine, 1) == 1 &&
          kb_metronome_custom_sound_loaded(engine, 0) == 0,
      "abi: only the loaded slot reads loaded"
  );
}

void TestAbiFailedLoadAndClear(kb_engine* engine, const std::string& in) {
  Check(
      kb_metronome_load_custom_sound(engine, 1, (in + ".missing").c_str()) ==
          KB_ERROR_INVALID_ARGUMENT,
      "abi: a failed load is refused"
  );
  Check(
      kb_metronome_custom_sound_loaded(engine, 1) == 1,
      "abi: a failed load keeps the slot's sound"
  );
  kb_metronome_clear_custom_sound(engine, 1);
  Check(
      kb_metronome_custom_sound_loaded(engine, 1) == 0,
      "abi: clear empties the slot"
  );
}

void TestAbi() {
  constexpr uint32_t kRate = kitbag::kCustomSoundRate;
  kb_engine* engine = nullptr;
  Check(kb_engine_create(&engine) == KB_OK, "abi: engine created");
  const std::string in = Fixture("cs_abi", Body(kRate / 2, 0.4F), 1, kRate);
  const std::string out = OutPath("cs_abi_out");
  Check(
      kb_click_sound_prepare(in.c_str(), out.c_str()) == KB_OK,
      "abi: kb_click_sound_prepare writes the file"
  );
  TestAbiLoad(engine, out);
  TestAbiFailedLoadAndClear(engine, out);
  kb_engine_destroy(engine);
  std::remove(in.c_str());
  std::remove(out.c_str());
}

}  // namespace

void RunRaceTests() {
  TestLoadWhileRendering();
  TestAbi();
}

}  // namespace click_sound_test

int main() {
  click_sound_test::RunPrepareTests();
  click_sound_test::RunRefusalTests();
  click_sound_test::RunWriteTests();
  click_sound_test::RunLoadTests();
  click_sound_test::RunVoiceTests();
  click_sound_test::RunRaceTests();
  if (kitbag_test::g_checks != kExpectedChecks) {
    std::fprintf(
        stderr,
        "FAIL: ran %d checks, expected %d\n",
        kitbag_test::g_checks,
        kExpectedChecks
    );
    return 1;
  }
  if (kitbag_test::g_failures > 0) {
    std::fprintf(
        stderr,
        "%d of %d checks failed\n",
        kitbag_test::g_failures,
        kitbag_test::g_checks
    );
    return 1;
  }
  std::printf(
      "click_sound_verify: all %d checks passed\n",
      kitbag_test::g_checks
  );
  return 0;
}
