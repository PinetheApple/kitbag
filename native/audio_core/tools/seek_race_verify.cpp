// Threaded seek-race verify (#25). A live Seek must never corrupt the ring the
// render callback is draining. One thread drains Process/Render in a tight loop
// while another seeks the same live source; the source's buffered count must
// never exceed the ring it lives in.
//
// The pre-fix path repositioned in place: AudioSource::Seek's ring Clear stored
// tail=0 under the draining callback, so a racing Read stored tail+n over it and
// left tail past head — read_available() then underflows to ~2^64 and the
// callback reads stale ring memory for many blocks. The rebuild-and-republish
// fix swaps a fresh source in by RtPublisher and never Clears a live ring, so the
// buffered count stays within the ring's capacity. That bound is the assertion:
// contiguity alone misses the underflow, whose stale reads are often themselves
// contiguous — only the desynced index shows.
#include <atomic>
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <filesystem>
#include <functional>
#include <string>
#include <thread>
#include <vector>

#if defined(__linux__)
#include <pthread.h>
#include <sched.h>
#endif

#include "check.h"
#include "media/audio_source.h"
#include "mixer/mixer.h"
#include "player/player.h"
#include "wav_fixture.h"

namespace {

using kitbag_test::Check;

// Pins the calling thread to one core so the render and seek threads run on
// different cores. Without it the scheduler often co-schedules them on one core
// and the narrow Read/Clear overlap never happens, hiding the bug on a busy
// machine. Best-effort, Linux-only; elsewhere the test still runs, just weaker.
void PinSelfToCpu(int cpu) {
#if defined(__linux__)
  cpu_set_t set;
  CPU_ZERO(&set);
  CPU_SET(cpu, &set);
  pthread_setaffinity_np(pthread_self(), sizeof(set), &set);
#else
  (void)cpu;
#endif
}

constexpr uint32_t kSampleRate = 48000;
constexpr uint32_t kBlock = 4096;
constexpr float kOffset = 1000.0f;
// Far longer than the transport can advance between seeks, so playback never
// auto-stops mid-test and Process/Render keeps draining the source.
constexpr uint64_t kTotalFrames = 4000000;
// The ring holds at most this many frames; a buffered count above it is the
// desync's underflowed index, never a real fill.
constexpr uint64_t kRingCeiling = kitbag::AudioSource::kDefaultRingFrames;
constexpr auto kMixerDuration = std::chrono::milliseconds(5000);
constexpr auto kPlayerDuration = std::chrono::milliseconds(3000);

// Distinct, widely-spaced targets well below the length, so each seek moves the
// read position far and the race has fresh ground every iteration.
constexpr uint64_t kTargets[] =
    {100000, 2000000, 500000, 3000000, 1200000, 2800000};
constexpr int kTargetCount = 6;

// Mono ramp at the engine rate, so no resampler stands between the ring and the
// reader. Values stay integer and below 2^24, exact in float.
class RampReader : public kitbag::SourceReader {
 public:
  uint32_t channels() const override {
    return 1;
  }
  uint32_t sample_rate() const override {
    return kSampleRate;
  }
  uint64_t total_frames() const override {
    return kTotalFrames;
  }
  kitbag::ReadResult ReadFrames(float* dst, uint64_t frames) override {
    uint64_t n = 0;
    for (; n < frames && pos_ < kTotalFrames; ++n, ++pos_) {
      dst[n] = kOffset + static_cast<float>(pos_);
    }
    const auto status = pos_ >= kTotalFrames ? kitbag::ReadStatus::kEndOfStream
                                             : kitbag::ReadStatus::kOk;
    return {n, status};
  }
  bool SeekToFrame(uint64_t frame) override {
    pos_ = frame;
    return true;
  }

 private:
  uint64_t pos_ = 0;
};

bool BlockHasAudio(const std::vector<float>& out) {
  for (float s : out) {
    if (s != 0.0f) return true;
  }
  return false;
}

// Shared between the render thread and the seek loop. `now` is the reclamation
// clock the seeks pass to Publish; `max_buffered` is the worst desync seen.
struct RaceStats {
  std::atomic<bool> stop{false};
  std::atomic<uint64_t> now{0};
  std::atomic<uint64_t> max_buffered{0};
  std::atomic<uint64_t> blocks{0};
  std::atomic<uint64_t> audio_blocks{0};
  uint64_t seeks = 0;
};

// One render + one buffered probe. `render` fills the block, `buffered` reads
// the live source through its published node (realtime-safe).
void RenderLoop(
    RaceStats* s,
    const std::function<void(std::vector<float>*)>& render,
    const std::function<uint64_t()>& buffered
) {
  PinSelfToCpu(0);
  std::vector<float> out(static_cast<size_t>(kBlock) * 2, 0.0f);
  while (!s->stop.load(std::memory_order_relaxed)) {
    render(&out);
    s->now.fetch_add(kBlock, std::memory_order_relaxed);
    s->blocks.fetch_add(1, std::memory_order_relaxed);
    if (BlockHasAudio(out)) {
      s->audio_blocks.fetch_add(1, std::memory_order_relaxed);
    }
    const uint64_t b = buffered();
    if (b > s->max_buffered.load(std::memory_order_relaxed)) {
      s->max_buffered.store(b, std::memory_order_relaxed);
    }
    std::this_thread::sleep_for(std::chrono::microseconds(200));
  }
}

void SeekLoop(
    RaceStats* s,
    std::chrono::steady_clock::duration duration,
    const std::function<void(uint64_t, uint64_t)>& seek
) {
  const auto deadline = std::chrono::steady_clock::now() + duration;
  // Stop early once the desync is seen: the bug is proven, and letting a
  // corrupted source run on risks a hang the assertion would never reach.
  while (std::chrono::steady_clock::now() < deadline &&
         s->max_buffered.load(std::memory_order_relaxed) <= kRingCeiling) {
    const uint64_t target = kTargets[s->seeks % kTargetCount];
    seek(target, s->now.load(std::memory_order_relaxed));
    ++s->seeks;
  }
}

void Assert(RaceStats* s, const char* who) {
  char msg[96];
  std::snprintf(msg, sizeof(msg), "%s: render loop ran many blocks", who);
  Check(s->blocks.load() > 500, msg);
  std::snprintf(msg, sizeof(msg), "%s: many live seeks were issued", who);
  Check(s->seeks > 100, msg);
  std::snprintf(
      msg,
      sizeof(msg),
      "%s: the source actually produced audio",
      who
  );
  Check(s->audio_blocks.load() > 0, msg);
  std::snprintf(msg, sizeof(msg), "%s: buffered never exceeds the ring", who);
  Check(s->max_buffered.load() <= kRingCeiling, msg);
}

// Spawns the render thread, runs the seek loop for `duration`, then joins.
void RunRace(
    RaceStats* stats,
    const std::function<void(std::vector<float>*)>& render,
    const std::function<uint64_t()>& buffered,
    std::chrono::steady_clock::duration duration,
    const std::function<void(uint64_t, uint64_t)>& seek
) {
  std::thread renderer([&] { RenderLoop(stats, render, buffered); });
  SeekLoop(stats, duration, seek);
  stats->stop.store(true);
  renderer.join();
}

void RunMixerRace() {
  RampReader reader;  // declared first: it must outlive the mixer that reads it
  kitbag::Mixer mixer(kSampleRate);
  Check(
      mixer.SetTrackSource(0, &reader, 0, true),
      "mixer-race: the ramp source loads"
  );
  mixer.Play();

  RaceStats stats;
  RunRace(
      &stats,
      [&](std::vector<float>* out) { mixer.Process(out->data(), kBlock); },
      [&] { return mixer.rt_track_buffered(0); },
      kMixerDuration,
      [&](uint64_t target, uint64_t now) { mixer.Seek(target, now, true); }
  );
  mixer.Stop();
  mixer.ReleaseRetiredSources();
  Assert(&stats, "mixer-race");
}

std::string WriteRampWav() {
  std::vector<float> pcm(kTotalFrames);
  for (uint64_t i = 0; i < kTotalFrames; ++i) {
    pcm[i] = kOffset + static_cast<float>(i);
  }
  const std::filesystem::path path =
      std::filesystem::temp_directory_path() / "kitbag_seek_race.wav";
  if (!media_test::WriteFloatWav(path.string(), pcm, 1, kSampleRate)) return "";
  return path.string();
}

void RunPlayerRace() {
  const std::string path = WriteRampWav();
  Check(!path.empty(), "player-race: the ramp WAV writes");
  if (path.empty()) return;

  kitbag::Player player(kSampleRate);
  Check(player.Load(path.c_str(), 0, true), "player-race: the ramp WAV loads");
  player.Play();

  RaceStats stats;
  RunRace(
      &stats,
      [&](std::vector<float>* out) {
        for (float& s : *out) s = 0.0f;  // Render accumulates, so clear first
        player.Render(out->data(), kBlock);
      },
      [&] { return player.rt_buffered(); },
      kPlayerDuration,
      [&](uint64_t target, uint64_t now) { player.Seek(target, now, true); }
  );
  player.Pause();
  player.ReleaseRetiredSources();
  Assert(&stats, "player-race");

  std::error_code ec;
  std::filesystem::remove(path, ec);
}

constexpr int kExpectedChecks = 11;

int Report() {
  if (kitbag_test::g_checks != kExpectedChecks) {
    std::fprintf(
        stderr,
        "seek_race_verify: ran %d checks, expected %d\n",
        kitbag_test::g_checks,
        kExpectedChecks
    );
    return 1;
  }
  if (kitbag_test::g_failures == 0) {
    std::printf("seek_race_verify: all checks passed\n");
    return 0;
  }
  std::fprintf(
      stderr,
      "seek_race_verify: %d failure(s)\n",
      kitbag_test::g_failures
  );
  return 1;
}

}  // namespace

int main() {
  // The render thread pins to cpu 0; put the seek loop on cpu 2 when the machine
  // has one (0 and 1 are often SMT siblings, which share a core and serialise),
  // else cpu 1. A different physical core is what makes Read and Clear overlap.
  const unsigned cpus = std::thread::hardware_concurrency();
  PinSelfToCpu(cpus >= 3 ? 2 : 1);
  RunMixerRace();
  RunPlayerRace();
  return Report();
}
