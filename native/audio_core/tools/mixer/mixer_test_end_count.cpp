#include "mixer_test_stretch_support.h"

namespace mixer_test {
namespace {

constexpr int64_t kTailFrames = 400;
constexpr int kRestBlocks = 3;
constexpr int64_t kEndLoopStart = kLongFrames - 1300;
constexpr int kLoopBlocks = 20;
constexpr int kPlayedBlocks = 2;
constexpr uint64_t kTinySong = 300;
constexpr float kEndSpeed = 0.75f;
constexpr int64_t kStretchSong = kSampleRate;
constexpr int64_t kStretchSeekBack = kSampleRate / 3 + 7;
constexpr int kMaxStretchBlocks = 200;

void CheckCount(
    const kitbag::Mixer& mixer,
    uint32_t expected,
    const char* label
) {
  const uint32_t got = mixer.end_count();
  Check(got == expected, label);
  if (got != expected) {
    std::fprintf(stderr, "  end count %u, expected %u\n", got, expected);
  }
}

void RenderBlocks(kitbag::Mixer* mixer, int blocks) {
  for (int b = 0; b < blocks; ++b) RenderBlock(mixer);
}

void PlayTail(kitbag::Mixer* mixer) {
  mixer->Seek(kLongFrames - kTailFrames, kZeroClock, false);
  mixer->Play();
  RenderBlock(mixer);
}

void TestEndCountsOnceAndAgainAfterSeek() {
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, kLongFrames, 0.0f);
  CheckCount(mixer, 0, "end count: a fresh mixer reads 0");
  PlayTail(&mixer);
  CheckCount(mixer, 0, "end count: the finishing block has not ended yet");
  RenderBlock(&mixer);
  CheckCount(mixer, 1, "end count: reaching the end counts one");
  RenderBlocks(&mixer, kRestBlocks);
  CheckCount(mixer, 1, "end count: resting at the end does not count again");
  PlayTail(&mixer);
  RenderBlocks(&mixer, kRestBlocks);
  CheckCount(mixer, 2, "end count: seek back and play to the end counts again");
}

void TestLoopOverTheEndNeverCounts() {
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, kLongFrames, 0.0f);
  mixer.SetLoop(kEndLoopStart, kLongFrames, kZeroClock, false);
  mixer.Seek(kEndLoopStart, kZeroClock, false);
  mixer.Play();
  RenderBlocks(&mixer, kLoopBlocks);
  Check(
      mixer.is_playing(),
      "end count: a loop ending at the song end plays on"
  );
  CheckCount(mixer, 0, "end count: wrapping at the song end does not count");
}

void TestStopAndPauseDoNotCount() {
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, kLongFrames, 0.0f);
  mixer.Play();
  RenderBlocks(&mixer, kPlayedBlocks);
  mixer.Pause();
  RenderBlocks(&mixer, kRestBlocks);
  CheckCount(mixer, 0, "end count: a pause before the end does not count");
  mixer.Play();
  RenderBlock(&mixer);
  mixer.Stop(kZeroClock, false);
  RenderBlocks(&mixer, kRestBlocks);
  Check(!mixer.is_playing(), "end count: the stop applied");
  CheckCount(mixer, 0, "end count: a stop before the end does not count");
}

void TestSongShorterThanABlockCountsOnce() {
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, kTinySong, 0.0f);
  mixer.Play();
  RenderBlocks(&mixer, kRestBlocks);
  Check(!mixer.is_playing(), "end count: a sub-block song stops");
  CheckCount(mixer, 1, "end count: a sub-block song counts once");
}

void TestStretchedEndCountsOnce() {
  kitbag::Mixer mixer(kSampleRate);
  LoadTone(&mixer, kStretchSong);
  mixer.SetRate(kEndSpeed, kZeroClock, false);
  mixer.Seek(kStretchSong - kStretchSeekBack, kZeroClock, false);
  mixer.Play();
  bool engaged = false;
  for (int b = 0; b < kMaxStretchBlocks && (b == 0 || mixer.is_playing());
       ++b) {
    RenderPaced(&mixer, 1);
    engaged = engaged || mixer.stretch_engaged();
  }
  RenderPaced(&mixer, kRestBlocks);
  Check(engaged, "end count: the slowed song plays through the stretch");
  Check(!mixer.is_playing(), "end count: the slowed song stops at its end");
  CheckCount(mixer, 1, "end count: a slowed song's end counts once");
}

}  // namespace

void RunEndCountTests() {
  TestEndCountsOnceAndAgainAfterSeek();
  TestLoopOverTheEndNeverCounts();
  TestStopAndPauseDoNotCount();
  TestSongShorterThanABlockCountsOnce();
  TestStretchedEndCountsOnce();
}

}  // namespace mixer_test
