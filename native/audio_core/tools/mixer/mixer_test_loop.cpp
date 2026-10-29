#include <cmath>
#include <filesystem>
#include <numbers>
#include <vector>

#include "mixer_test_support.h"

namespace mixer_test {
namespace {

// Off block boundaries, so a wrap applied per block, not per frame, lands
// visibly wrong.
constexpr int64_t kLoopStart = 1234;
constexpr int64_t kLoopEnd = 4321;
constexpr int64_t kLoopLength = kLoopEnd - kLoopStart;

float EqualPowerBlend(int64_t into, int64_t crossfade) {
  const double angle = (static_cast<double>(into) + 0.5) *
                       (std::numbers::pi / 2.0) /
                       static_cast<double>(crossfade);
  const double tail = static_cast<double>(kLoopEnd + into);
  const double head = static_cast<double>(kLoopStart + into);
  return static_cast<float>(tail * std::cos(angle) + head * std::sin(angle));
}

kitbag::Mixer::LoopResult SetTestLoop(kitbag::Mixer* mixer) {
  return mixer->SetLoop(kLoopStart, kLoopEnd, 0, false);
}

void TestMasterGainScalesTheMix() {
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, kLongFrames, kLongOffset);
  mixer.SetGain(0, 1.5f);
  mixer.SetMasterGain(0.3f);
  Check(mixer.master_gain() == 1.0f, "master: unchanged until drained");
  mixer.Seek(777, 0, false);
  mixer.Play();
  const std::vector<float> out = RenderBlock(&mixer);
  Check(mixer.master_gain() == 0.3f, "master: the drained value is mirrored");
  const float scaled = (kLongOffset + 777.0f) * 1.5f * 0.3f;
  Check(std::fabs(out[0] - scaled) <= 1.0f, "master: track x master gain");
  mixer.SetMasterGain(5.0f);
  Drain(&mixer);
  Check(mixer.master_gain() == kitbag::Mixer::kMaxGain, "master: clamps");
}

void TestUnloadedTrackGainIsUnity() {
  kitbag::Mixer mixer(kSampleRate);
  Check(mixer.gain(3) == 1.0f, "gain: an unloaded track reports 1.0");
  Check(mixer.gain(kitbag::Mixer::kMaxTracks) == 0.0f, "gain: out of range");
}

void TestLoopWrapsAtTheExactFrame() {
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, kLoopTrackFrames, 0.0f);
  Check(SetTestLoop(&mixer) == kitbag::Mixer::LoopResult::kOk, "loop: set");
  const int64_t from = 3000;
  const int64_t crossfade = mixer.crossfade_frames();
  mixer.Seek(from, 0, false);
  mixer.Play();
  const std::vector<float> left = RenderLeft(&mixer, 12);
  for (int64_t wrap : {kLoopEnd - from, kLoopEnd - from + kLoopLength}) {
    ExpectAt(left, wrap - 1, kLoopEnd - 1, "loop: last frame before the wrap");
    ExpectAt(left, wrap, EqualPowerBlend(0, crossfade), "loop: fade opens");
    ExpectAt(
        left,
        wrap + crossfade - 1,
        EqualPowerBlend(crossfade - 1, crossfade),
        "loop: fade closes"
    );
    ExpectAt(
        left,
        wrap + crossfade,
        static_cast<float>(kLoopStart + crossfade),
        "loop: the head plays on after the fade"
    );
  }
  const int64_t stream = from + 12 * kBlock;
  const auto song = kLoopStart + (stream - kLoopEnd) % kLoopLength;
  Check(mixer.position() == static_cast<uint64_t>(song), "loop: position");
}

class SineReader : public kitbag::SourceReader {
 public:
  static constexpr double kHz = 220.0;
  static constexpr double kAmplitude = 0.5;
  static float At(int64_t frame) {
    const double t = static_cast<double>(frame) / kSampleRate;
    return static_cast<float>(
        kAmplitude * std::sin(2 * std::numbers::pi * kHz * t)
    );
  }
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
    for (uint64_t i = 0; i < frames; ++i) dst[i] = At(pos_ + i);
    pos_ += frames;
    return {frames, kitbag::ReadStatus::kOk};
  }
  bool SeekToFrame(uint64_t frame) override {
    pos_ = frame;
    return true;
  }

 private:
  uint64_t pos_ = 0;
};

float MaxStep(const std::vector<float>& left, size_t from, size_t to) {
  float worst = 0.0f;
  for (size_t i = from + 1; i < to && i < left.size(); ++i) {
    worst = std::max(worst, std::fabs(left[i] - left[i - 1]));
  }
  return worst;
}

// Loop points half a period out of phase: a hard cut steps by ~2x amplitude.
void TestCrossfadeHasNoSpike() {
  constexpr int64_t kStart = 10000;
  constexpr int64_t kEnd = 14473;
  constexpr float kMaxStepRatio = 3.0f;
  Check(
      std::fabs(SineReader::At(kStart) - SineReader::At(kEnd - 1)) > 0.5f,
      "spike: the fixture's hard cut would step by more than 0.5"
  );
  SineReader reader;
  kitbag::Mixer mixer(kSampleRate);
  mixer.SetTrackSource(0, &reader, 0, false);
  mixer.SetLoop(kStart, kEnd, 0, false);
  mixer.Seek(kEnd - 600, 0, false);
  mixer.Play();
  const std::vector<float> left = RenderLeft(&mixer, 3);
  const float steady = MaxStep(left, 0, 500);
  const float wrap = MaxStep(left, 590, 900);
  Check(steady > 0.0f, "spike: the steady sine moves");
  Check(wrap <= kMaxStepRatio * steady, "spike: no step at the wrap");
  std::printf("  crossfade: steady step %.4f, wrap step %.4f\n", steady, wrap);
}

void TestSeekAroundTheLoop() {
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, kLoopTrackFrames, 0.0f);
  SetTestLoop(&mixer);
  mixer.Seek(9000, 0, false);
  Drain(&mixer);
  Check(mixer.position() == kLoopStart, "loop seek: past the end lands on A");
  mixer.Play();
  ExpectAt(RenderLeft(&mixer, 1), 0, kLoopStart, "loop seek: A sounds");
  mixer.Seek(500, 0, false);
  const std::vector<float> before = RenderLeft(&mixer, 2);
  ExpectAt(before, 0, 500.0f, "loop seek: before A plays from there");
  ExpectAt(before, kLoopStart - 500, kLoopStart, "loop seek: and into A");
}

void TestClearLoopMidPlayContinues() {
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, kLoopTrackFrames, 0.0f);
  SetTestLoop(&mixer);
  mixer.Seek(4000, 0, false);
  mixer.Play();
  RenderLeft(&mixer, 1);
  const auto head = static_cast<float>(mixer.position());
  Check(mixer.ClearLoop(0, false), "clear: succeeds");
  const std::vector<float> left = RenderLeft(&mixer, 8);
  ExpectAt(left, 0, head, "clear: playback continues from the head");
  ExpectAt(
      left,
      kLoopEnd - static_cast<int64_t>(head),
      kLoopEnd,
      "clear: no wrap at B"
  );
}

void TestSetLoopWhilePlaying() {
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, kLoopTrackFrames, 0.0f);
  mixer.Seek(1000, 0, false);
  mixer.Play();
  RenderLeft(&mixer, 1);
  SetTestLoop(&mixer);
  ExpectAt(
      RenderLeft(&mixer, 1),
      0,
      1000.0f + kBlock,
      "set: a head before B holds"
  );
  mixer.ClearLoop(0, false);
  mixer.Seek(6000, 0, false);
  Drain(&mixer);
  SetTestLoop(&mixer);
  ExpectAt(
      RenderLeft(&mixer, 1),
      0,
      kLoopStart,
      "set: a head past B jumps to A"
  );
}

// The position mirror lags a queued seek by a block; the loop must build from
// the seek target, or the seek is silently undone.
void TestSetLoopRightAfterSeek() {
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, kLoopTrackFrames, 0.0f);
  mixer.Play();
  RenderLeft(&mixer, 4);
  mixer.Seek(1000, 0, false);
  SetTestLoop(&mixer);
  ExpectAt(RenderLeft(&mixer, 1), 0, 1000.0f, "set after seek: keeps the seek");
}

void TestSetLoopRejectsBadBounds() {
  using Result = kitbag::Mixer::LoopResult;
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, kLoopTrackFrames, 0.0f);
  const int64_t shortest =
      kitbag::Mixer::kMinLoopCrossfades * mixer.crossfade_frames();
  const auto longest = static_cast<int64_t>(kLoopTrackFrames);
  Check(mixer.SetLoop(-1, 2000, 0, false) == Result::kInvalid, "bounds: A < 0");
  Check(
      mixer.SetLoop(0, longest + 1, 0, false) == Result::kInvalid,
      "bounds: B > end"
  );
  Check(
      mixer.SetLoop(100, 100 + shortest - 1, 0, false) == Result::kInvalid,
      "bounds: short"
  );
  Check(
      mixer.SetLoop(100, 100 + shortest, 0, false) == Result::kOk,
      "bounds: shortest ok"
  );
}

void TestLoopKeepsUnequalStemsAligned() {
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, 3000, 0.0f);
  LoadRamp(&mixer, 1, kLoopTrackFrames, kLongOffset);
  SetTestLoop(&mixer);
  mixer.SetMute(0, true);
  mixer.SetMute(1, true);
  mixer.Seek(2000, 0, false);
  mixer.Play();
  ExpectSilentBlock(RenderBlock(&mixer), "aligned: muting all is silent");
  Check(mixer.is_playing(), "aligned: muting all does not stop the loop");
  mixer.SetMute(0, false);
  mixer.SetMute(1, false);
  const std::vector<float> left = RenderLeft(&mixer, 5);
  const int64_t played = 2000 + kBlock;
  const int64_t crossfade = mixer.crossfade_frames();
  ExpectAt(left, 0, kLongOffset + 2.0f * played, "aligned: both sum");
  ExpectAt(left, 3000 - played, kLongOffset + 3000, "aligned: short one ends");
  const float both = kLongOffset + 2.0f * (kLoopStart + crossfade);
  ExpectAt(left, kLoopEnd - played + crossfade, both, "aligned: both return");
}

// Deleting one stem's file makes its reopen fail. The other stem must not be
// moved either, or the two drift apart for the rest of the song.
void TestFailedRebuildMovesNothing() {
  using Result = kitbag::Mixer::LoopResult;
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, kLoopTrackFrames, 0.0f);
  LoadRamp(&mixer, 1, kLoopTrackFrames, kLongOffset);
  mixer.Seek(2000, 0, false);
  mixer.Play();
  RenderLeft(&mixer, 1);
  std::error_code ec;
  std::filesystem::remove(TempFiles().back(), ec);
  mixer.Seek(9000, 0, false);
  const Result loop = mixer.SetLoop(kLoopStart, kLoopEnd, 0, false);
  Check(loop == Result::kRebuildFailed, "rebuild: the loop reports failure");
  const float next = 2000.0f + kBlock;
  ExpectAt(
      RenderLeft(&mixer, 1),
      0,
      kLongOffset + 2 * next,
      "rebuild: no move"
  );
  Check(mixer.position() == 2000 + 2 * kBlock, "rebuild: the head holds");
}

}  // namespace

void RunLoopTests() {
  TestMasterGainScalesTheMix();
  TestUnloadedTrackGainIsUnity();
  TestLoopWrapsAtTheExactFrame();
  TestCrossfadeHasNoSpike();
  TestSeekAroundTheLoop();
  TestClearLoopMidPlayContinues();
  TestSetLoopWhilePlaying();
  TestSetLoopRightAfterSeek();
  TestSetLoopRejectsBadBounds();
  TestLoopKeepsUnequalStemsAligned();
  TestFailedRebuildMovesNothing();
}

}  // namespace mixer_test
