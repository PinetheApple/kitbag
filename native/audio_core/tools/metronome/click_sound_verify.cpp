#include "kitbag_api.h"

#include <atomic>
#include <cmath>
#include <cstdio>
#include <thread>
#include <vector>

#include "click_sound_test_support.h"
#include "counting_allocator.h"
#include "metronome/custom_sound_limits.h"
#include "metronome/sample_voices.h"

constexpr int kExpectedChecks = 66;

namespace click_sound_test {

using kitbag::SampleVoices;
using kitbag_test::Check;

namespace {

constexpr uint32_t kRaceBlock = 64;
constexpr int kRaceBlocks = 20000;
constexpr int kTriggerStride = 7;
constexpr float kRaceLevel = 0.5F;
constexpr size_t kRaceMinFrames = 300;
constexpr size_t kRaceFrameSpread = 4000;

struct RaceState {
  SampleVoices voices;
  std::atomic<uint64_t> clock{0};
  std::atomic<bool> done{false};
  bool bounded = true;
};

void RenderLoop(RaceState* state) {
  for (int block = 0; block < kRaceBlocks; ++block) {
    state->voices.BeginBlock();
    for (uint32_t i = 0; i < kRaceBlock; ++i) {
      const int slot = static_cast<int>(i) % kitbag::kCustomSoundSlots;
      if (i % kTriggerStride == 0) state->voices.Trigger(slot, 1.0F);
      const float sample = state->voices.Render();
      state->bounded =
          state->bounded && std::isfinite(sample) &&
          std::fabs(sample) <= kRaceLevel * SampleVoices::kMaxVoices;
    }
    state->clock.fetch_add(kRaceBlock, std::memory_order_release);
  }
  state->done.store(true, std::memory_order_release);
}

int PublishLoop(RaceState* state) {
  int publishes = 0;
  while (!state->done.load(std::memory_order_acquire)) {
    const uint64_t now = state->clock.load(std::memory_order_acquire);
    const int slot = publishes % kitbag::kCustomSoundSlots;
    if (publishes % kTriggerStride == 0) {
      state->voices.Clear(slot, now, true);
    } else {
      const size_t frames =
          kRaceMinFrames +
          (static_cast<size_t>(publishes) * 131) % kRaceFrameSpread;
      state->voices
          .Publish(slot, std::vector<float>(frames, kRaceLevel), now, true);
    }
    ++publishes;
    std::this_thread::yield();
  }
  return publishes;
}

void TestLoadWhileRendering() {
  RaceState state;
  std::thread render(RenderLoop, &state);
  const int publishes = PublishLoop(&state);
  render.join();
  std::printf(
      "  race: %d publishes against %d blocks, %zu still retired\n",
      publishes,
      kRaceBlocks,
      state.voices.retired_size()
  );
  Check(
      state.bounded,
      "race: every rendered sample is finite and within the pool's reach"
  );
  Check(
      publishes > kRaceBlocks / kTriggerStride,
      "race: the app thread published throughout the render"
  );
  Check(
      state.voices.retired_size() < static_cast<size_t>(publishes),
      "race: retired sounds were freed during the run"
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

namespace {
size_t g_heap_baseline = 0;
}  // namespace

void ResetHeapPeak() {
  g_heap_baseline = kitbag_test::g_live_bytes.load();
  kitbag_test::g_peak_bytes.store(g_heap_baseline);
}

size_t HeapPeakGrowth() {
  return kitbag_test::g_peak_bytes.load() - g_heap_baseline;
}

size_t LiveHeapBytes() {
  return kitbag_test::g_live_bytes.load();
}

void RunRaceTests() {
  TestLoadWhileRendering();
  TestAbi();
}

}  // namespace click_sound_test

int main() {
  click_sound_test::RunPrepareTests();
  click_sound_test::RunRefusalTests();
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
