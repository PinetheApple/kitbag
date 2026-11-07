#include <cstddef>
#include <vector>

#include "mixer_test_stretch_support.h"

namespace mixer_test {
namespace {

constexpr float kSpeed = 0.75f;
constexpr float kKey = 3.0f;
constexpr int64_t kSongFrames = int64_t{3} * kSampleRate;
constexpr double kNextSongHz = 523.0;
constexpr int kCompareBlocks = 30;

std::vector<float> NextSong() {
  return ToneFixture(
      {.frames = kSongFrames,
       .burst_at = kSampleRate / 7,
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
  const char* bypassed;
  const char* exact;
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

void CheckNextSongAfterSession(const SessionCase& kase) {
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
  Check(!mixer.stretch_engaged() && mixer.key_bus_count() == 0, kase.bypassed);
  CheckBitExact(got, NeverStretched(), kase.exact);
}

constexpr SessionCase kCases[] = {
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

}  // namespace

void RunUnityTests() {
  for (const SessionCase& kase : kCases) CheckNextSongAfterSession(kase);
}

}  // namespace mixer_test
