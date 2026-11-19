// Replaces global operator new for the whole tool, so the heap high-water mark
// of a render can be compared across song lengths.
#include <atomic>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <new>
#include <numbers>
#include <string>

#include "mixdown_test_support.h"

namespace {

std::atomic<size_t> g_live_bytes{0};
std::atomic<size_t> g_peak_bytes{0};
// Keeps the returned pointer max_align_t aligned.
constexpr size_t kHeader = 16;

void* CountedAlloc(size_t size) {
  auto* block = static_cast<unsigned char*>(std::malloc(size + kHeader));
  if (block == nullptr) throw std::bad_alloc();
  *reinterpret_cast<size_t*>(block) = size;
  const size_t live = g_live_bytes.fetch_add(size) + size;
  size_t peak = g_peak_bytes.load();
  while (live > peak && !g_peak_bytes.compare_exchange_weak(peak, live)) {
  }
  return block + kHeader;
}

void CountedFree(void* ptr) {
  if (ptr == nullptr) return;
  auto* block = static_cast<unsigned char*>(ptr) - kHeader;
  g_live_bytes.fetch_sub(*reinterpret_cast<size_t*>(block));
  std::free(block);
}

}  // namespace

void* operator new(size_t size) {
  return CountedAlloc(size);
}
void* operator new[](size_t size) {
  return CountedAlloc(size);
}
void operator delete(void* ptr) noexcept {
  CountedFree(ptr);
}
void operator delete[](void* ptr) noexcept {
  CountedFree(ptr);
}
void operator delete(void* ptr, size_t) noexcept {
  CountedFree(ptr);
}
void operator delete[](void* ptr, size_t) noexcept {
  CountedFree(ptr);
}

namespace mixdown_test {
namespace {

constexpr uint64_t kShortSeconds = 20;
constexpr uint64_t kLongSeconds = 180;
constexpr double kToneHz = 220.0;
constexpr float kToneAmplitude = 0.5f;
// Allocator and container rounding; a buffer of the song would be megabytes.
constexpr size_t kSlackBytes = 256 * 1024;
constexpr double kBytesPerKiB = 1024.0;

// Never holds the song: each sample is computed from its frame index.
class SynthReader : public kitbag::SourceReader {
 public:
  explicit SynthReader(uint64_t frames) : frames_(frames) {}
  uint32_t channels() const override {
    return kStereo;
  }
  uint32_t sample_rate() const override {
    return kSampleRate;
  }
  uint64_t total_frames() const override {
    return frames_;
  }
  kitbag::ReadResult ReadFrames(float* dst, uint64_t frames) override {
    uint64_t n = 0;
    for (; n < frames && position_ < frames_; ++n, ++position_) {
      const double phase =
          2.0 * std::numbers::pi * kToneHz * position_ / kSampleRate;
      dst[n * kStereo] = kToneAmplitude * static_cast<float>(std::sin(phase));
      dst[n * kStereo + 1] = -dst[n * kStereo];
    }
    const bool full = n == frames;
    return {
        n,
        full ? kitbag::ReadStatus::kOk : kitbag::ReadStatus::kEndOfStream
    };
  }
  bool SeekToFrame(uint64_t frame) override {
    if (frame > frames_) return false;
    position_ = frame;
    return true;
  }

 private:
  uint64_t frames_;
  uint64_t position_ = 0;
};

struct Run {
  size_t peak_bytes = 0;
  uint64_t frames = 0;
};

Run RenderSeconds(uint64_t seconds, const std::string& tag) {
  SynthReader reader(seconds * kSampleRate);
  kitbag::MixSnapshot snapshot;
  snapshot.tracks.push_back({.reader = &reader});
  const std::string path = TempPath(tag, ".wav");
  const size_t baseline = g_live_bytes.load();
  g_peak_bytes.store(baseline);
  Run run;
  {
    kitbag::MixdownJob job(kSampleRate);
    Check(
        job.Start(snapshot, path) == kitbag::MixdownJob::StartResult::kOk,
        (tag + ": start").c_str()
    );
    Check(WaitForJob(job), (tag + ": finishes").c_str());
    run.peak_bytes = g_peak_bytes.load() - baseline;
  }
  run.frames = WavFrames(path);
  return run;
}

}  // namespace

void RunMemoryTests() {
  const Run short_run = RenderSeconds(kShortSeconds, "memory_short");
  const Run long_run = RenderSeconds(kLongSeconds, "memory_long");
  std::printf(
      "mixdown peak heap: %.0f KiB for %llu s, %.0f KiB for %llu s\n",
      short_run.peak_bytes / kBytesPerKiB,
      (unsigned long long)kShortSeconds,
      long_run.peak_bytes / kBytesPerKiB,
      (unsigned long long)kLongSeconds
  );
  Check(
      long_run.frames == kLongSeconds * kSampleRate,
      "memory: the long song is written whole"
  );
  Check(
      long_run.peak_bytes <= short_run.peak_bytes + kSlackBytes,
      "memory: peak heap does not grow with song length"
  );
}

}  // namespace mixdown_test
