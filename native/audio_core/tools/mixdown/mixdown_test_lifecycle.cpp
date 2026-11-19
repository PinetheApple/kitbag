#include <string>

#include "memory_audio_reader.h"
#include "mixdown_test_support.h"

namespace mixdown_test {
namespace {

using kitbag::MixdownJob;
using State = MixdownJob::State;
using Result = MixdownJob::StartResult;

constexpr uint64_t kGatedFrames = 200000;
// Past the prime and a few blocks, short of the song: the render waits here.
constexpr uint64_t kGateAt = 20000;
constexpr uint64_t kShortFrames = 30000;
constexpr double kToneHz = 330.0;
constexpr float kToneAmplitude = 0.4f;

kitbag::MixSnapshot ReaderSnapshot(kitbag::SourceReader* reader) {
  kitbag::MixSnapshot snapshot;
  snapshot.tracks.push_back({.reader = reader});
  return snapshot;
}

void TestCancelLeavesNothing() {
  media_test::MemoryAudioReader reader(
      Sine(kGatedFrames, kToneHz, kToneAmplitude),
      kMono,
      kSampleRate
  );
  reader.set_gate(kGateAt);
  MixdownJob job(kSampleRate);
  const std::string path = TempPath("cancel", ".wav");
  const std::string part = path + kitbag::WavWriter::kPartSuffix;
  const kitbag::MixSnapshot snapshot = ReaderSnapshot(&reader);
  Check(job.Start(snapshot, path) == Result::kOk, "cancel: start");
  Check(job.state() == State::kRunning, "cancel: RUNNING");
  Check(Exists(part), "cancel: writes to .part while running");
  Check(
      job.Start(snapshot, path) == Result::kBusy,
      "cancel: second start BUSY"
  );
  job.Cancel();
  Check(WaitForJob(job), "cancel: stops");
  Check(job.state() == State::kCancelled, "cancel: CANCELLED");
  Check(job.progress() < 1.0, "cancel: progress short of 1");
  Check(!Exists(part), "cancel: .part removed");
  Check(!Exists(path), "cancel: no file");
}

void TestSpaceCheck() {
  media_test::MemoryAudioReader reader(
      Sine(kShortFrames, kToneHz, kToneAmplitude),
      kMono,
      kSampleRate
  );
  const uint64_t needed = kitbag::WavWriter::FileBytes(kShortFrames) +
                          MixdownJob::kSpaceMarginBytes;
  uint64_t free = needed - 1;
  MixdownJob job(kSampleRate);
  job.set_free_bytes([&free](const std::string&) { return free; });
  const std::string path = TempPath("space", ".wav");
  const kitbag::MixSnapshot snapshot = ReaderSnapshot(&reader);
  Check(job.Start(snapshot, path) == Result::kNoSpace, "space: one byte short");
  Check(job.state() == State::kIdle, "space: state unchanged");
  Check(!Exists(path + kitbag::WavWriter::kPartSuffix), "space: no .part");
  free = needed;
  Check(job.Start(snapshot, path) == Result::kOk, "space: exactly enough");
  Check(WaitForJob(job) && job.state() == State::kDone, "space: DONE");
  Check(ReadWav(path).frames() == kShortFrames, "space: whole song written");
}

}  // namespace

void RunLifecycleTests() {
  TestCancelLeavesNothing();
  TestSpaceCheck();
}

}  // namespace mixdown_test
