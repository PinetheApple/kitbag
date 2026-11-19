#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <limits>
#include <thread>

#include "mixdown_test_support.h"

namespace mixdown_test {
namespace {

constexpr float kS16Max = std::numeric_limits<int16_t>::max();

template <typename Done>
bool PollUntil(Done done) {
  const auto deadline = std::chrono::steady_clock::now() + kMixdownTimeout;
  while (!done()) {
    if (std::chrono::steady_clock::now() > deadline) return false;
    std::this_thread::sleep_for(kPoll);
  }
  return true;
}

}  // namespace

kb_engine* OpenEngine() {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) {
    std::fprintf(stderr, "FIXTURE FAIL: kb_engine_create\n");
    ++g_failures;
    return nullptr;
  }
  kb_engine_reserve_render_frames(engine, kLiveBlock);
  return engine;
}

bool WaitForMixdown(kb_engine* engine) {
  return PollUntil([engine] {
    return kb_mixdown_current_state(engine) != KB_MIXDOWN_STATE_RUNNING;
  });
}

bool WaitForJob(const kitbag::MixdownJob& job) {
  return PollUntil([&job] {
    return job.state() != kitbag::MixdownJob::State::kRunning;
  });
}

bool WaitForFile(const std::string& path) {
  return PollUntil([&path] { return Exists(path); });
}

kitbag::MixSnapshot ReaderSnapshot(kitbag::SourceReader* reader) {
  kitbag::MixSnapshot snapshot;
  snapshot.tracks.push_back({.reader = reader});
  snapshot.longest_frames = reader->total_frames();
  return snapshot;
}

int16_t ExpectedS16(float sample) {
  const float clamped = std::fmin(1.0f, std::fmax(-1.0f, sample));
  return static_cast<int16_t>(std::lround(clamped * kS16Max));
}

std::vector<int16_t> RenderLive(kb_engine* engine, uint64_t frames) {
  std::vector<int16_t> take;
  std::vector<float> block(static_cast<size_t>(kLiveBlock) * kStereo);
  while (take.size() < frames * kStereo) {
    kb_engine_render(engine, block.data(), kLiveBlock);
    std::this_thread::sleep_for(kLivePace);
    for (const float sample : block) {
      if (take.size() == frames * kStereo) break;
      take.push_back(ExpectedS16(sample));
    }
  }
  return take;
}

float PeakOf(const std::vector<int16_t>& samples) {
  int peak = 0;
  for (const int16_t sample : samples) peak = std::max(peak, std::abs(sample));
  return static_cast<float>(peak) / kS16Max;
}

uint64_t
Mismatches(const std::vector<int16_t>& got, const std::vector<int16_t>& want) {
  const size_t common = std::min(got.size(), want.size());
  uint64_t differ = std::max(got.size(), want.size()) - common;
  for (size_t i = 0; i < common; ++i) differ += got[i] != want[i] ? 1 : 0;
  return differ;
}

}  // namespace mixdown_test
