#include <chrono>
#include <filesystem>
#include <memory>
#include <string>
#include <vector>

#include "memory_audio_reader.h"
#include "mixdown_test_support.h"

namespace mixdown_test {
namespace {

using kitbag::MixdownJob;
using State = MixdownJob::State;
using Result = MixdownJob::StartResult;

constexpr uint64_t kGatedFrames = 200000;
constexpr uint64_t kGateAt = 20000;
constexpr uint64_t kShortFrames = 30000;
constexpr double kToneHz = 330.0;
constexpr float kToneAmplitude = 0.4f;
constexpr std::chrono::milliseconds kShortStall{200};
// Far under kStallTimeout, so a destructor that waited out the stall fails.
constexpr std::chrono::milliseconds kPromptDestroy{1000};

std::vector<float> Tone(uint64_t frames) {
  return Sine(frames, kToneHz, kToneAmplitude);
}

void TestStallFails() {
  media_test::MemoryAudioReader reader(Tone(kGatedFrames), kMono, kSampleRate);
  reader.set_gate(kGateAt);
  MixdownJob job(kSampleRate);
  job.set_stall_timeout(kShortStall);
  const std::string path = TempPath("stall", ".wav");
  Check(
      job.Start(ReaderSnapshot(&reader), path) == Result::kOk,
      "stall: start"
  );
  Check(WaitForJob(job), "stall: stops");
  Check(job.state() == State::kFailed, "stall: FAILED");
  Check(!Exists(path + kitbag::WavWriter::kPartSuffix), "stall: no .part");
  Check(!Exists(path), "stall: no file");
}

void TestRenameFailure() {
  media_test::MemoryAudioReader reader(Tone(kShortFrames), kMono, kSampleRate);
  const std::string path = TempPath("into_dir", "");
  std::filesystem::create_directory(path);
  MixdownJob job(kSampleRate);
  Check(
      job.Start(ReaderSnapshot(&reader), path) == Result::kOk,
      "rename: start"
  );
  Check(WaitForJob(job), "rename: stops");
  Check(job.state() == State::kFailed, "rename: FAILED");
  Check(!Exists(path + kitbag::WavWriter::kPartSuffix), "rename: no .part");
  Check(
      std::filesystem::is_directory(path) && std::filesystem::is_empty(path),
      "rename: the directory is untouched"
  );
}

void TestEmptySongFails() {
  media_test::MemoryAudioReader reader({}, kMono, kSampleRate);
  MixdownJob job(kSampleRate);
  const std::string path = TempPath("empty", ".wav");
  Check(
      job.Start(ReaderSnapshot(&reader), path) == Result::kOk,
      "empty: start"
  );
  Check(WaitForJob(job), "empty: stops");
  Check(job.state() == State::kFailed, "empty: FAILED, not DONE");
  Check(!Exists(path), "empty: no file");
}

void TestDestroyWhileRunning() {
  media_test::MemoryAudioReader reader(Tone(kGatedFrames), kMono, kSampleRate);
  reader.set_gate(kGateAt);
  auto job = std::make_unique<MixdownJob>(kSampleRate);
  const std::string path = TempPath("destroy", ".wav");
  const std::string part = path + kitbag::WavWriter::kPartSuffix;
  Check(
      job->Start(ReaderSnapshot(&reader), path) == Result::kOk,
      "destroy: start"
  );
  Check(WaitForFile(part), "destroy: running");
  const auto before = std::chrono::steady_clock::now();
  job.reset();
  const auto took = std::chrono::steady_clock::now() - before;
  Check(took < kPromptDestroy, "destroy: returns promptly");
  Check(!Exists(part) && !Exists(path), "destroy: leaves no file");
}

}  // namespace

void RunFailureTests() {
  TestStallFails();
  TestRenameFailure();
  TestEmptySongFails();
  TestDestroyWhileRunning();
}

}  // namespace mixdown_test
