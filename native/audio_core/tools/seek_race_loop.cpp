// Live set/clear of a loop seconds past the head must leave the ramp unbroken:
// no jump, replay, dropped frame or silent block while a plan is in flight.
#include "seek_race_loop.h"

#include <atomic>
#include <chrono>
#include <cstdint>
#include <filesystem>
#include <string>
#include <thread>
#include <vector>

#include "check.h"
#include "mixer/mixer.h"
#include "wav_fixture.h"

namespace seek_race {
namespace {

using kitbag_test::Check;

constexpr uint32_t kRate = 48000;
constexpr uint32_t kBlock = 512;
constexpr uint64_t kFrames = 1500000;
constexpr float kOffset = 1000.0f;
constexpr int64_t kLoopLead = 3 * kRate;
constexpr int64_t kLoopLength = kRate;
constexpr auto kDuration = std::chrono::milliseconds(2000);
// About 5x realtime: fast enough to cover many relayouts, slow enough that the
// read-ahead never underruns and fakes a break in the ramp.
constexpr auto kPace = std::chrono::microseconds(2000);
constexpr uint64_t kMinBlocks = 300;
constexpr uint64_t kMinRelayouts = 20;

struct Stats {
  std::atomic<bool> stop{false};
  std::atomic<uint64_t> now{0};
  std::atomic<uint64_t> blocks{0};
  std::atomic<uint64_t> breaks{0};
  std::atomic<uint64_t> heard{0};
  uint64_t relayouts = 0;
};

std::string WriteRamp() {
  std::vector<float> pcm(kFrames);
  for (uint64_t i = 0; i < kFrames; ++i) {
    pcm[i] = kOffset + static_cast<float>(i);
  }
  const auto path =
      std::filesystem::temp_directory_path() / "kitbag_loop_race.wav";
  if (!media_test::WriteFloatWav(path.string(), pcm, 1, kRate)) return "";
  return path.string();
}

void RenderLoop(kitbag::Mixer* mixer, Stats* s) {
  std::vector<float> out(static_cast<size_t>(kBlock) * 2, 0.0f);
  float previous = 0.0f;
  while (!s->stop.load(std::memory_order_relaxed)) {
    mixer->Process(out.data(), kBlock);
    s->now.fetch_add(kBlock, std::memory_order_relaxed);
    s->blocks.fetch_add(1, std::memory_order_relaxed);
    for (uint32_t f = 0; f < kBlock; ++f) {
      const float sample = out[2 * f];
      if (previous != 0.0f && sample != previous + 1.0f) s->breaks++;
      if (sample != 0.0f) s->heard++;
      previous = sample;
    }
    std::this_thread::sleep_for(kPace);
  }
}

void Relayouts(kitbag::Mixer* mixer, Stats* s) {
  const auto deadline = std::chrono::steady_clock::now() + kDuration;
  while (std::chrono::steady_clock::now() < deadline) {
    const auto start = static_cast<int64_t>(mixer->position()) + kLoopLead;
    mixer->SetLoop(start, start + kLoopLength, s->now.load(), true);
    mixer->ClearLoop(s->now.load(), true);
    s->relayouts += 2;
  }
}

}  // namespace

void RunMixerLoopRace() {
  const std::string path = WriteRamp();
  Check(!path.empty(), "loop-race: the ramp WAV writes");
  if (path.empty()) return;
  Stats stats;
  {
    kitbag::Mixer mixer(kRate);
    Check(mixer.LoadTrack(0, path.c_str(), 0, true), "loop-race: loads");
    mixer.Play();
    std::thread renderer([&] { RenderLoop(&mixer, &stats); });
    Relayouts(&mixer, &stats);
    stats.stop.store(true);
    renderer.join();
    mixer.Pause();
    mixer.ReleaseRetiredSources();
  }
  Check(stats.blocks.load() > kMinBlocks, "loop-race: many blocks rendered");
  Check(stats.relayouts > kMinRelayouts, "loop-race: many live relayouts");
  Check(stats.heard.load() > 0, "loop-race: the ramp was heard");
  Check(stats.breaks.load() == 0, "loop-race: the ramp never breaks");
  if (stats.breaks.load() != 0) {
    std::fprintf(
        stderr,
        "  %llu breaks\n",
        (unsigned long long)stats.breaks.load()
    );
  }
  std::error_code ec;
  std::filesystem::remove(path, ec);
}

}  // namespace seek_race
