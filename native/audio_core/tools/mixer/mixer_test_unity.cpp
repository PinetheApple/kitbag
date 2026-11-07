#include <algorithm>
#include <cstddef>
#include <utility>
#include <vector>

#include "media/audio_source.h"
#include "mixer_test_stretch_support.h"

namespace mixer_test {
namespace {

constexpr float kSpeed = 0.75f;
constexpr float kKey = 3.0f;
constexpr int64_t kSongFrames = int64_t{3} * kSampleRate;
constexpr double kNextSongHz = 523.0;
constexpr int64_t kNextSongBurstAt = kSampleRate / 7;
constexpr int kCompareBlocks = 30;
constexpr int64_t kPausedSeek = 9001;
constexpr int64_t kStopFrame = 0;
constexpr int kBypassBlocks = 7;
constexpr int kGoodTrack = 0;
constexpr int kRefusedTrack = 1;

std::vector<float> NextSong() {
  return ToneFixture(
      {.frames = kSongFrames,
       .burst_at = kNextSongBurstAt,
       .bed = true,
       .steady_hz = kNextSongHz}
  );
}

std::vector<float> NeverStretched() {
  kitbag::Mixer mixer(kSampleRate);
  LoadPcm(&mixer, 0, NextSong());
  mixer.Play();
  return RenderPaced(&mixer, kCompareBlocks);
}

void LeaveUnityBySpeed(kitbag::Mixer* mixer) {
  mixer->SetRate(kSpeed, kZeroClock, false);
}

void ReturnSpeed(kitbag::Mixer* mixer) {
  mixer->SetRate(kitbag::kUnityRate, kZeroClock, false);
}

void LeaveUnityByKey(kitbag::Mixer* mixer) {
  mixer->SetTrackPitch(0, kKey, kZeroClock, false);
}

void ReturnKey(kitbag::Mixer* mixer) {
  mixer->SetTrackPitch(0, 0.0f, kZeroClock, false);
}

void UnloadShifted(kitbag::Mixer* mixer) {
  mixer->UnloadTrack(0, kZeroClock, false);
}

struct SessionCase {
  void (*leave)(kitbag::Mixer*);
  void (*back)(kitbag::Mixer*);
  const char* bypassed_label;
  const char* exact_label;
};

void CheckBitExact(
    const std::vector<float>& got,
    const std::vector<float>& want,
    const char* label
) {
  size_t first = 0;
  while (first < got.size() && first < want.size() &&
         got[first] == want[first]) {
    ++first;
  }
  const bool same = got.size() == want.size() && first == got.size();
  Check(same, label);
  if (!same) {
    std::fprintf(
        stderr,
        "  first difference at frame %zu of %zu\n",
        first,
        want.size()
    );
  }
}

void CheckNextSongAfterSession(
    const SessionCase& kase,
    const std::vector<float>& never_stretched
) {
  kitbag::Mixer mixer(kSampleRate);
  LoadPcm(&mixer, 0, ToneFixture({.frames = kSongFrames, .bed = true}));
  kase.leave(&mixer);
  mixer.Play();
  RenderPaced(&mixer, HandOverBlocks(mixer));
  mixer.Stop(kZeroClock, false);
  RenderPaced(&mixer, 1);
  kase.back(&mixer);
  LoadPcm(&mixer, 0, NextSong());
  mixer.Play();
  const std::vector<float> got = RenderPaced(&mixer, kCompareBlocks);
  Check(
      !mixer.stretch_engaged() && mixer.key_bus_count() == 0,
      kase.bypassed_label
  );
  CheckBitExact(got, never_stretched, kase.exact_label);
}

constexpr SessionCase kSessionCases[] = {
    {LeaveUnityBySpeed,
     ReturnSpeed,
     "unity: 0.75x, stop, 1.0x, load leaves nothing engaged",
     "unity: 0.75x, stop, 1.0x, load plays bit-exact to a never-stretched run"},
    {LeaveUnityByKey,
     ReturnKey,
     "unity: +3 st, stop, 0 st, load leaves nothing engaged",
     "unity: +3 st, stop, 0 st, load plays bit-exact to a never-stretched "
     "run"},
    {LeaveUnityByKey,
     UnloadShifted,
     "unity: +3 st, stop, unload, load leaves nothing engaged",
     "unity: +3 st, stop, unload, load plays bit-exact to a never-stretched "
     "run"},
};

void CheckPausedWithinLag(const kitbag::Mixer& mixer) {
  const auto fed = static_cast<int64_t>(mixer.fed_frames());
  const auto heard = static_cast<int64_t>(mixer.position());
  const int64_t lag = LagFrames(mixer.rate());
  CheckNear(
      fed - heard,
      lag,
      kOnsetToleranceFrames,
      "unity: the paused frame stands the stretch lag behind the fed frames"
  );
}

int64_t PauseHere(kitbag::Mixer* mixer) {
  mixer->Pause();
  RenderPaced(mixer, 1);
  CheckPausedWithinLag(*mixer);
  return static_cast<int64_t>(mixer->position());
}

int64_t PauseThenSeek(kitbag::Mixer* mixer) {
  PauseHere(mixer);
  mixer->Seek(kPausedSeek, kZeroClock, false);
  RenderPaced(mixer, 1);
  return kPausedSeek;
}

int64_t StopWithNoBlock(kitbag::Mixer* mixer) {
  mixer->Stop(kZeroClock, false);
  return kStopFrame;
}

struct RestCase {
  void (*leave)(kitbag::Mixer*);
  void (*back)(kitbag::Mixer*);
  int64_t (*rest)(kitbag::Mixer*);
  bool continues;
  const char* bypassed_label;
  const char* first_label;
  const char* last_label;
  const char* run_label;
};

void CheckRampFrom(
    const std::vector<float>& left,
    int64_t frame,
    const char* first_label,
    const char* last_label
) {
  ExpectAt(left, 0, static_cast<float>(frame), first_label);
  const int64_t last = kBlock - 1;
  ExpectAt(left, last, static_cast<float>(frame + last), last_label);
}

void CheckResumeAtUnity(const RestCase& kase) {
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, kLoopTrackFrames, 0.0f);
  kase.leave(&mixer);
  mixer.Play();
  RenderPaced(&mixer, HandOverBlocks(mixer));
  const int64_t frame = kase.rest(&mixer);
  kase.back(&mixer);
  RenderPaced(&mixer, 1);
  mixer.Play();
  const std::vector<float> left = RenderPaced(&mixer, 1);
  Check(!mixer.stretch_engaged(), kase.bypassed_label);
  CheckRampFrom(left, frame, kase.first_label, kase.last_label);
  const kitbag::SongClock& clock = mixer.song_clock();
  Check(
      clock.opens_on_jump && clock.continues_run == kase.continues,
      kase.run_label
  );
}

constexpr RestCase kRestCases[] = {
    {LeaveUnityBySpeed,
     ReturnSpeed,
     PauseHere,
     true,
     "unity: paused at 0.75x, 1.0x leaves nothing engaged",
     "unity: paused at 0.75x, 1.0x resumes on the paused frame",
     "unity: paused at 0.75x, 1.0x plays on frame for frame",
     "unity: paused at 0.75x, 1.0x continues the run"},
    {LeaveUnityByKey,
     ReturnKey,
     PauseHere,
     true,
     "unity: paused at +3 st, 0 st leaves nothing engaged",
     "unity: paused at +3 st, 0 st resumes on the paused frame",
     "unity: paused at +3 st, 0 st plays on frame for frame",
     "unity: paused at +3 st, 0 st continues the run"},
    {LeaveUnityBySpeed,
     ReturnSpeed,
     PauseThenSeek,
     false,
     "unity: paused seek at 0.75x, 1.0x leaves nothing engaged",
     "unity: paused seek at 0.75x, 1.0x resumes on the seek frame",
     "unity: paused seek at 0.75x, 1.0x plays on frame for frame",
     "unity: paused seek at 0.75x, 1.0x still lands as a jump"},
    {LeaveUnityBySpeed,
     ReturnSpeed,
     StopWithNoBlock,
     false,
     "unity: 1.0x right after a stop at 0.75x leaves nothing engaged",
     "unity: 1.0x right after a stop at 0.75x resumes on the stop frame",
     "unity: 1.0x right after a stop at 0.75x plays on frame for frame",
     "unity: 1.0x right after a stop at 0.75x still lands as a jump"},
};

class ReseekRefusingReader : public kitbag::SourceReader {
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
    std::fill_n(dst, frames, 0.0f);
    return {frames, kitbag::ReadStatus::kOk};
  }
  bool SeekToFrame(uint64_t) override {
    return std::exchange(first_seek_, false);
  }

 private:
  bool first_seek_ = true;
};

// Unloading the only stem mid-play leaves a nonzero head and no bank, so 0.75x
// engages unprimed and the refused stem's reseek is a real seek.
void HoldUnprimedAtUnity(kitbag::Mixer* mixer) {
  LoadRamp(mixer, kGoodTrack, kLoopTrackFrames, 0.0f);
  mixer->Play();
  RenderPaced(mixer, kBypassBlocks);
  mixer->UnloadTrack(kGoodTrack, kZeroClock, false);
  mixer->SetRate(kSpeed, kZeroClock, false);
  mixer->SetRate(kitbag::kUnityRate, kZeroClock, false);
  mixer->Pause();
  RenderPaced(mixer, 1);
}

void TestRefusedLoadLeavesTheBypass() {
  kitbag::Mixer mixer(kSampleRate);
  HoldUnprimedAtUnity(&mixer);
  ReseekRefusingReader reader;
  Check(
      mixer.SetTrackSource(kRefusedTrack, &reader, kZeroClock, false) ==
          kitbag::Mixer::LoadResult::kPrimeFailed,
      "unity: a stem whose reseek fails is refused at rest"
  );
  LoadRamp(&mixer, kGoodTrack, kLoopTrackFrames, 0.0f);
  RenderPaced(&mixer, 1);
  const auto frame = static_cast<int64_t>(mixer.position());
  mixer.Play();
  const std::vector<float> left = RenderPaced(&mixer, 1);
  Check(
      !mixer.stretch_engaged() && mixer.key_bus_count() == 0,
      "unity: after a refused load the next stem leaves nothing engaged"
  );
  CheckRampFrom(
      left,
      frame,
      "unity: after a refused load the next stem resumes unstretched",
      "unity: after a refused load the next stem plays frame for frame"
  );
}

}  // namespace

void RunUnityTests() {
  const std::vector<float> never_stretched = NeverStretched();
  for (const SessionCase& kase : kSessionCases) {
    CheckNextSongAfterSession(kase, never_stretched);
  }
  for (const RestCase& kase : kRestCases) CheckResumeAtUnity(kase);
  TestRefusedLoadLeavesTheBypass();
}

}  // namespace mixer_test
