// Two synthetic songs, generated on demand and never buffered, are analysed and
// the heap's high-water mark is held to the bound kitbag_api.h documents.
#include "kitbag_api.h"

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <new>
#include <numbers>

#include "analysis/beat_tracker.h"
#include "analysis/song_analysis.h"
#include "check.h"
#include "media/audio_source.h"

namespace {

size_t g_live_bytes = 0;
size_t g_peak_bytes = 0;

// Prefix every block with its size so delete can debit it; 16 keeps the
// returned pointer max_align_t aligned.
constexpr size_t kHeader = 16;

void* CountedAlloc(size_t size) {
  auto* block = static_cast<unsigned char*>(std::malloc(size + kHeader));
  if (block == nullptr) throw std::bad_alloc();
  *reinterpret_cast<size_t*>(block) = size;
  g_live_bytes += size;
  if (g_live_bytes > g_peak_bytes) g_peak_bytes = g_live_bytes;
  return block + kHeader;
}

void CountedFree(void* ptr) {
  if (ptr == nullptr) return;
  auto* block = static_cast<unsigned char*>(ptr) - kHeader;
  g_live_bytes -= *reinterpret_cast<size_t*>(block);
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

namespace {

constexpr uint32_t kRate = 44100;
constexpr uint32_t kChannels = 2;
// 132 BPM; a click per beat over a tone that steps each bar, so beats and
// downbeats are both found and every analysis stage does its full work.
constexpr uint64_t kBeatFrames = 20045;
constexpr uint64_t kClickFrames = 64;
constexpr int kBeatsPerBar = 4;
constexpr int kToneCycle = 5;
constexpr float kToneBaseHz = 200.0f;
constexpr float kToneStepHz = 90.0f;
constexpr float kToneAmp = 0.3f;
constexpr float kClickAmp = 0.8f;

// Never holds the song: each sample is computed from its frame index.
class SynthReader : public kitbag::SourceReader {
 public:
  explicit SynthReader(uint64_t frames) : frames_(frames) {}

  uint32_t channels() const override {
    return kChannels;
  }
  uint32_t sample_rate() const override {
    return kRate;
  }
  uint64_t total_frames() const override {
    return frames_;
  }

  kitbag::ReadResult ReadFrames(float* dst, uint64_t frames) override {
    uint64_t n = 0;
    for (; n < frames && position_ < frames_; ++n, ++position_) {
      const float v = Sample(position_);
      dst[n * kChannels] = v;
      dst[n * kChannels + 1] = 0.5f * v;
    }
    return {
        n,
        n == frames ? kitbag::ReadStatus::kOk : kitbag::ReadStatus::kEndOfStream
    };
  }

  bool SeekToFrame(uint64_t frame) override {
    if (frame > frames_) return false;
    position_ = frame;
    return true;
  }

 private:
  static float Sample(uint64_t frame) {
    const uint64_t beat = frame / kBeatFrames;
    const uint64_t offset = frame % kBeatFrames;
    const auto bar = static_cast<float>((beat / kBeatsPerBar) % kToneCycle);
    const float hz = kToneBaseHz + kToneStepHz * bar;
    const float phase = 2.0f * std::numbers::pi_v<float> * hz *
                        static_cast<float>(offset) / static_cast<float>(kRate);
    const float click = offset < kClickFrames ? kClickAmp : 0.0f;
    return click + kToneAmp * std::sin(phase);
  }

  uint64_t frames_;
  uint64_t position_ = 0;
};

struct Run {
  size_t peak_bytes = 0;
  size_t beats = 0;
  size_t downbeats = 0;
  kb_result status = KB_ERROR_INTERNAL;
};

Run AnalyzeSeconds(uint64_t seconds) {
  SynthReader reader(seconds * kRate);
  kitbag::BeatResult result;
  const size_t baseline = g_live_bytes;
  g_peak_bytes = baseline;
  Run run;
  run.status = kitbag::AnalyzeSong(reader, "synth", nullptr, &result);
  run.peak_bytes = g_peak_bytes - baseline;
  run.beats = result.beat_times.size();
  run.downbeats = result.downbeat_indices.size();
  return run;
}

constexpr uint64_t kShortSeconds = 60;
constexpr uint64_t kLongSeconds = 240;
// About twice the documented per-second and fixed costs, so only a regression
// of the same order as the bound itself fails.
constexpr double kMaxBytesPerSecond = 2048.0;
constexpr size_t kMaxFixedBytes = 1 << 20;
constexpr size_t kLabelSize = 96;

void CheckRun(const Run& run, uint64_t seconds) {
  kitbag_test::Check(run.status == KB_OK, "memory: synthetic song analyses OK");
  kitbag_test::Check(
      run.beats > seconds && run.downbeats > seconds / kBeatsPerBar,
      "memory: beats and downbeats found, so every stage did its work"
  );
}

void CheckBounds(double per_second, size_t peak_bytes, uint64_t seconds) {
  char label[kLabelSize];
  std::snprintf(
      label,
      sizeof(label),
      "memory: peak heap grows at most %.0f B per second of audio",
      kMaxBytesPerSecond
  );
  kitbag_test::Check(per_second <= kMaxBytesPerSecond, label);
  std::snprintf(
      label,
      sizeof(label),
      "memory: peak heap within %zu B + %.0f B per second of audio",
      kMaxFixedBytes,
      kMaxBytesPerSecond
  );
  kitbag_test::Check(
      static_cast<double>(peak_bytes) <=
          kMaxFixedBytes + kMaxBytesPerSecond * static_cast<double>(seconds),
      label
  );
}

void CheckGrowth(
    const Run& short_run,
    const Run& long_run,
    uint64_t short_s,
    uint64_t long_s
) {
  const double per_second = (static_cast<double>(long_run.peak_bytes) -
                             static_cast<double>(short_run.peak_bytes)) /
                            static_cast<double>(long_s - short_s);
  std::printf(
      "analyze_memory_verify: peak heap %zu B at %llus, %zu B at %llus "
      "(%.0f B per second of audio)\n",
      short_run.peak_bytes,
      static_cast<unsigned long long>(short_s),
      long_run.peak_bytes,
      static_cast<unsigned long long>(long_s),
      per_second
  );
  CheckBounds(per_second, long_run.peak_bytes, long_s);
}

}  // namespace

// Optional "<short> <long>" seconds override the defaults for measurement runs.
int main(int argc, char** argv) {
  const uint64_t short_s =
      argc == 3 ? std::strtoull(argv[1], nullptr, 10) : kShortSeconds;
  const uint64_t long_s =
      argc == 3 ? std::strtoull(argv[2], nullptr, 10) : kLongSeconds;
  const Run short_run = AnalyzeSeconds(short_s);
  const Run long_run = AnalyzeSeconds(long_s);
  CheckRun(short_run, short_s);
  CheckRun(long_run, long_s);
  CheckGrowth(short_run, long_run, short_s, long_s);
  if (kitbag_test::g_failures == 0) {
    std::printf("analyze_memory_verify: all checks passed\n");
    return 0;
  }
  std::fprintf(
      stderr,
      "analyze_memory_verify: %d failure(s)\n",
      kitbag_test::g_failures
  );
  return 1;
}
