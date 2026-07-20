// The contract's awkward corners: a starved ring, pause/resume, seek, and
// shutdown while the read-ahead thread is still running.
#include <chrono>
#include <vector>

#include "audio_source_drain.h"
#include "media/audio_source.h"
#include "media_test_support.h"
#include "memory_audio_reader.h"

namespace media_test {
namespace {

using kitbag::AudioSource;

constexpr uint64_t kGateFrames = 100;

// Called with exactly one gated frame already consumed, so the remainder is
// known: a starved read is short by a countable amount, not an approximate one.
void CheckStarvedRead(AudioSource* source) {
  const uint64_t before = source->underruns();
  std::vector<float> block(512 * kChannels, kPoison);
  const uint32_t got = source->Read(block.data(), 512);
  kitbag_test::Check(got == kGateFrames - 1, "underrun: short read is exact");
  kitbag_test::Check(!source->is_at_end(), "underrun: is not end of stream");
  kitbag_test::Check(
      source->underruns() == before + 1,
      "underrun: counted once"
  );
  kitbag_test::Check(
      block[got * kChannels] == 0.0F && block.back() == 0.0F,
      "underrun: the undelivered tail is silence"
  );
}

// Drains the one frame the gate lets through first, so the ring is known to
// hold exactly kGateFrames - 1 when the starved read runs.
void TestUnderrun() {
  MemoryAudioReader reader(RampSamples(kTotalFrames, kChannels), kChannels);
  reader.set_gate(kGateFrames);
  AudioSource source;
  source.Open(&reader, kRingFrames);
  source.Start();

  std::vector<float> one(kChannels, kPoison);
  kitbag_test::Check(
      WaitUntil([&] { return source.Read(one.data(), 1) == 1; }),
      "underrun: the gated frames reach the ring"
  );
  CheckStarvedRead(&source);

  reader.set_gate(kTotalFrames);
  const DrainResult rest = Drain(&source, 256, kGateFrames * kChannels);
  kitbag_test::Check(
      rest.frames == kTotalFrames - kGateFrames && rest.integrity,
      "underrun: the stream resumes where it stalled"
  );
}

// Pause and resume with no seek in between: the read-ahead the producer had
// already buffered must survive the join, or A5's pause drops audio.
void TestPauseResume() {
  MemoryAudioReader reader(RampSamples(kTotalFrames, kChannels), kChannels);
  AudioSource source;
  source.Open(&reader, kRingFrames);
  source.Start();
  kitbag_test::Check(
      ReadExactly(&source, 256, 0),
      "pause: the first 256 frames are in order"
  );
  kitbag_test::Check(source.position() == 256, "pause: position tracks reads");

  source.Stop();
  kitbag_test::Check(!source.is_running(), "pause: stops");
  kitbag_test::Check(source.position() == 256, "pause: position survives stop");
  kitbag_test::Check(source.Start(), "pause: restarts");

  const DrainResult rest = Drain(&source, 128, 256 * kChannels);
  kitbag_test::Check(
      rest.frames == kTotalFrames - 256,
      "pause: resume drops no frames"
  );
  kitbag_test::Check(rest.integrity, "pause: resume loses no ordering");
}

void TestSeek() {
  MemoryAudioReader reader(RampSamples(1000, kChannels), kChannels);
  AudioSource source;
  source.Open(&reader, kRingFrames);
  source.Start();
  // Consume first, so the producer has demonstrably buffered read-ahead past
  // this point: without it the seek could land on a ring that was still empty
  // and a failure to discard the stale frames would go unnoticed.
  kitbag_test::Check(ReadExactly(&source, 64, 0), "seek: reads before seeking");
  kitbag_test::Check(!source.Seek(500), "seek: refused while the thread runs");
  source.Stop();

  kitbag_test::Check(source.Seek(500), "seek: accepted once stopped");
  kitbag_test::Check(!source.Seek(1001), "seek: refused past the end");
  kitbag_test::Check(source.position() == 500, "seek: position moves");
  source.Start();
  const DrainResult result = Drain(&source, 128, 500 * kChannels);
  kitbag_test::Check(result.frames == 500, "seek: only the tail remains");
  kitbag_test::Check(result.integrity, "seek: the tail starts at frame 500");
}

// A source that never yields must not hold the destructor. This bounds the
// shutdown; it cannot fail on a true deadlock, which hangs instead.
void TestDestroyWhileRunning() {
  MemoryAudioReader reader(RampSamples(kTotalFrames, kChannels), kChannels);
  reader.set_gate(0);
  const auto start = std::chrono::steady_clock::now();
  {
    AudioSource source;
    kitbag_test::Check(
        source.Open(&reader, kRingFrames) && source.Start(),
        "shutdown: source starts"
    );
  }
  const auto elapsed = std::chrono::steady_clock::now() - start;
  kitbag_test::Check(elapsed < kWaitTimeout, "shutdown: destructor joins fast");
}

// A second Open without a Close is the load-a-new-track path. It must present
// a fresh stream: counters cleared and none of the previous stream's buffered
// audio still in the ring.
void TestReopenClearsCounters() {
  MemoryAudioReader first(RampSamples(kTotalFrames, kChannels), kChannels);
  first.set_gate(kGateFrames);
  AudioSource source;
  source.Open(&first, kRingFrames);
  source.Start();
  std::vector<float> one(kChannels, kPoison);
  WaitUntil([&] { return source.Read(one.data(), 1) == 1; });
  std::vector<float> block(300 * kChannels, kPoison);
  source.Read(block.data(), 300);
  kitbag_test::Check(
      source.underruns() > 0,
      "reopen: the first stream underran"
  );
  source.Stop();

  MemoryAudioReader second(RampSamples(600, kChannels), kChannels);
  kitbag_test::Check(source.Open(&second, kRingFrames), "reopen: opens again");
  kitbag_test::Check(source.underruns() == 0, "reopen: clears the underruns");
  kitbag_test::Check(source.position() == 0, "reopen: resets the position");
}

// The offset ramp is the point: stale frames from the first stream carry
// values the second stream never contains, so a ring left un-reinitialised
// fails on the value rather than only on the count.
void TestReopenDiscardsBufferedAudio() {
  MemoryAudioReader first(RampSamples(kTotalFrames, kChannels), kChannels);
  AudioSource source;
  source.Open(&first, kRingFrames);
  source.Start();
  std::vector<float> one(kChannels, kPoison);
  kitbag_test::Check(
      WaitUntil([&] { return source.Read(one.data(), 1) == 1; }),
      "reopen: the first stream buffers ahead"
  );
  source.Stop();

  MemoryAudioReader second(RampSamples(600, kChannels, 100000), kChannels);
  source.Open(&second, kRingFrames);
  source.Start();
  const DrainResult result = Drain(&source, 128, 100000);
  kitbag_test::Check(result.frames == 600, "reopen: streams the new source");
  kitbag_test::Check(result.integrity, "reopen: no stale frames survive");
}

void TestLifecycleRejects() {
  MemoryAudioReader reader(RampSamples(100, kChannels), kChannels);
  AudioSource source;
  kitbag_test::Check(!source.Open(nullptr), "open: rejects a null reader");
  kitbag_test::Check(!source.Open(&reader, 0), "open: rejects a zero ring");
  kitbag_test::Check(!source.Start(), "start: refused before open");
  kitbag_test::Check(!source.Seek(0), "seek: refused before open");
  kitbag_test::Check(source.Open(&reader, kRingFrames), "open: accepts");
  kitbag_test::Check(source.Start(), "start: accepts");
  kitbag_test::Check(!source.Start(), "start: rejects a second start");
}

}  // namespace

void RunEdgeTests() {
  TestUnderrun();
  TestPauseResume();
  TestSeek();
  TestDestroyWhileRunning();
  TestReopenClearsCounters();
  TestReopenDiscardsBufferedAudio();
  TestLifecycleRejects();
}

}  // namespace media_test
