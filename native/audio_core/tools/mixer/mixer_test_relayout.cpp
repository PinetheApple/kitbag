#include <atomic>
#include <chrono>
#include <cmath>
#include <functional>
#include <string>
#include <thread>
#include <vector>

#include "mixer_test_support.h"

namespace mixer_test {
namespace {

constexpr int64_t kOldStart = 1000;
constexpr int64_t kOldEnd = 5000;
constexpr int64_t kNewStart = 2000;
constexpr int64_t kNewEnd = 9000;
constexpr int64_t kHeadBeforeWrap = 4000;
constexpr int kBlocksAcrossTheWrap = 2;
constexpr int64_t kJoinStart = 1234;
constexpr int64_t kJoinEnd = 4321;
constexpr int64_t kJoinFrom = 3000;
// Lands the load 185 frames into a pass, inside the wrap's crossfade.
constexpr int kBlocksBeforeJoin = 15;
constexpr int kBlocksAfterJoin = 13;
constexpr uint32_t kStemRate = 44100;
constexpr uint64_t kSixStemFrames = 441000;
constexpr int kSixStems = 6;
// Odd frames, so no move lands on a block or a crossfade boundary.
constexpr int64_t kSixSeek = 123457;
constexpr int64_t kSixLoopStart = 200003;
constexpr int64_t kSixLoopEnd = 230011;
constexpr int kStretchBlocks = 60;
// Over three passes of the six-stem loop.
constexpr int kLoopBlocks = 200;
// Offline pulls outrun the read-ahead; an underrun in one stem of a pair would
// break the cancellation for a reason that is not the mixer's.
constexpr auto kPacePerBlock = std::chrono::milliseconds(1);

// A mono ramp whose seek runs `hook` once, on the thread that armed it, so a
// test can render blocks while a relayout is mid-build.
class HookReader : public kitbag::SourceReader {
 public:
  uint32_t channels() const override {
    return kMono;
  }
  uint32_t sample_rate() const override {
    return kSampleRate;
  }
  uint64_t total_frames() const override {
    return kLoopTrackFrames;
  }
  kitbag::ReadResult ReadFrames(float* dst, uint64_t frames) override {
    for (uint64_t i = 0; i < frames; ++i) {
      dst[i] = static_cast<float>(pos_ + i);
    }
    pos_ += frames;
    return {frames, kitbag::ReadStatus::kOk};
  }
  bool SeekToFrame(uint64_t frame) override {
    pos_ = frame;
    const bool mine = std::this_thread::get_id() == owner_;
    if (mine && armed_.exchange(false)) hook_();
    return true;
  }
  void Arm(std::function<void()> hook) {
    hook_ = std::move(hook);
    owner_ = std::this_thread::get_id();
    armed_.store(true);
  }

 private:
  uint64_t pos_ = 0;
  std::function<void()> hook_;
  std::thread::id owner_;
  std::atomic<bool> armed_{false};
};

// The old loop wraps while the new one is still building; the head must count
// on from where it stood, not jump back to it and replay the gap.
void TestKeepAfterAnOldWrapDoesNotReplay() {
  HookReader reader;
  kitbag::Mixer mixer(kSampleRate);
  mixer.SetTrackSource(0, &reader, 0, false);
  mixer.SetLoop(kOldStart, kOldEnd, 0, false);
  mixer.Seek(kHeadBeforeWrap, 0, false);
  mixer.Play();
  RenderLeft(&mixer, 1);
  const auto head = static_cast<float>(mixer.position());
  reader.Arm([&] { RenderLeft(&mixer, kBlocksAcrossTheWrap); });
  mixer.SetLoop(kNewStart, kNewEnd, 0, false);
  ExpectAt(
      RenderLeft(&mixer, 1),
      0,
      head + kBlocksAcrossTheWrap * kBlock,
      "relayout: a keep after an old wrap plays on, never replays"
  );
}

void LoadSignedRamp(kitbag::Mixer* mixer, int track, uint32_t rate) {
  const float step = (track % 2 == 0 ? 1.0f : -1.0f) * (1 + track / 2);
  const std::string path = media_test::WriteRampWav(
      "kitbag_mixer_signed_" + std::to_string(track),
      kSixStemFrames,
      kMono,
      rate,
      0.0f,
      step
  );
  TempFiles().push_back(path);
  if (!mixer->LoadTrack(track, path.c_str(), 0, false)) {
    FixtureFail("could not load a signed ramp");
  }
}

float LoudestLeft(const std::vector<float>& left) {
  float loudest = 0.0f;
  for (float sample : left) loudest = std::max(loudest, std::fabs(sample));
  return loudest;
}

// The negated ramp cancels the first only while both read the same frame.
void TestLoadDuringALoopJoinsInSync() {
  kitbag::Mixer mixer(kSampleRate);
  LoadSignedRamp(&mixer, 0, kSampleRate);
  mixer.SetLoop(kJoinStart, kJoinEnd, 0, false);
  mixer.Seek(kJoinFrom, 0, false);
  mixer.Play();
  RenderLeft(&mixer, kBlocksBeforeJoin);
  LoadSignedRamp(&mixer, 1, kSampleRate);
  const float residue = LoudestLeft(RenderLeft(&mixer, kBlocksAfterJoin));
  Check(residue <= kEpsilon, "join: a stem loaded mid-loop is sample-locked");
  if (residue > kEpsilon) std::fprintf(stderr, "  residue %.3f\n", residue);
  mixer.SetMute(0, true);
  const auto head = static_cast<float>(mixer.position());
  ExpectAt(RenderLeft(&mixer, 1), 0, -head, "join: the new stem sounds");
}

float PacedResidue(kitbag::Mixer* mixer, int blocks) {
  float loudest = 0.0f;
  for (int b = 0; b < blocks; ++b) {
    loudest = std::max(loudest, LoudestLeft(RenderLeft(mixer, 1)));
    std::this_thread::sleep_for(kPacePerBlock);
  }
  return loudest;
}

// SPEC.md §7.5: three +/- pairs of 44.1 kHz stems, each pair a different slope,
// cancel only while all six stay on one frame through every transport move.
void TestSixStemsStaySampleLocked() {
  kitbag::Mixer mixer(kSampleRate);
  for (int t = 0; t < kSixStems; ++t) LoadSignedRamp(&mixer, t, kStemRate);
  mixer.Play();
  float residue = PacedResidue(&mixer, kStretchBlocks);
  mixer.Seek(kSixSeek, 0, false);
  residue = std::max(residue, PacedResidue(&mixer, kStretchBlocks));
  mixer.SetLoop(kSixLoopStart, kSixLoopEnd, 0, false);
  residue = std::max(residue, PacedResidue(&mixer, kLoopBlocks));
  for (int t : {2, 3}) mixer.SetMute(t, true);
  for (int t : {4, 5}) mixer.SetSolo(t, true);
  residue = std::max(residue, PacedResidue(&mixer, kStretchBlocks));
  mixer.ClearLoop(0, false);
  residue = std::max(residue, PacedResidue(&mixer, kStretchBlocks));
  Check(residue <= kEpsilon, "six: the pairs cancel through it all");
  if (residue > kEpsilon) std::fprintf(stderr, "  residue %.3f\n", residue);
  mixer.SetSolo(0, true);
  const float source = mixer.position() * kStemRate / kSampleRate;
  const float lone = RenderLeft(&mixer, 1)[0];
  Check(
      std::fabs(lone - source) <= 1.0f,
      "six: one stem alone plays its frame"
  );
}

}  // namespace

void RunRelayoutTests() {
  TestKeepAfterAnOldWrapDoesNotReplay();
  TestLoadDuringALoopJoinsInSync();
  TestSixStemsStaySampleLocked();
}

}  // namespace mixer_test
