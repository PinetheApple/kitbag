#include "mixer_test_stretch_support.h"

namespace mixer_test {
namespace {

constexpr float kSpeed = 0.75f;
constexpr int kChosenBuses = kitbag::TimeStretch::kMaxChosenConfigInstances;
constexpr int kExtraStem = kChosenBuses;
constexpr auto kFifthKey = static_cast<float>(kChosenBuses);
constexpr int kStems = kChosenBuses + 1;
constexpr int64_t kSongFrames = int64_t{10} * kSampleRate;
constexpr int kSettleBlocks = 40;
constexpr int kQuietBlocks = 60;
constexpr int kProbeBlocks = 60;
constexpr int64_t kSeekTo = kSampleRate / 2 + 7;
constexpr int64_t kBurstAfterSeek = 40011;
constexpr int kSwitchAtBlock = 10;
constexpr int kOnsetBlocks = 160;

void LoadStems(
    kitbag::Mixer* mixer,
    const std::vector<float>& first,
    const std::vector<float>& rest
) {
  for (int t = 0; t < kStems; ++t) LoadPcm(mixer, t, t == 0 ? first : rest);
  for (int t = 1; t < kChosenBuses; ++t) {
    mixer->SetTrackPitch(t, static_cast<float>(t), kZeroClock, false);
  }
  mixer->SetRate(kSpeed, kZeroClock, false);
}

int64_t ProbeLatency(kitbag::Mixer* mixer, int track) {
  RenderPaced(mixer, kQuietBlocks);
  mixer->SetMute(track, false);
  const std::vector<float> left = RenderPaced(mixer, kProbeBlocks);
  mixer->SetMute(track, true);
  return FirstAbove(left, kOnsetThreshold);
}

void CheckState(
    kitbag::Mixer* mixer,
    int probed_stem,
    int64_t lag,
    const char* label
) {
  const int buses = mixer->key_bus_count();
  const int64_t expected = OutputFramesFor(lag, kSpeed);
  const int64_t first = ProbeLatency(mixer, 0);
  const int64_t other = ProbeLatency(mixer, probed_stem);
  std::printf(
      "mixer_verify: %s: %d buses, latency %lld / %lld, expected %lld\n",
      label,
      buses,
      static_cast<long long>(first),
      static_cast<long long>(other),
      static_cast<long long>(expected)
  );
  CheckNear(first, expected, kOnsetToleranceFrames, label);
  CheckNear(other, expected, kOnsetToleranceFrames, label);
  CheckNear(first, other, kOnsetToleranceFrames, label);
}

void LoadMutedTones(kitbag::Mixer* mixer) {
  const std::vector<float> tone =
      ToneFixture({.frames = kSongFrames, .steady_hz = kBurstHz});
  LoadStems(mixer, tone, tone);
  for (int t = 0; t < kStems; ++t) mixer->SetMute(t, true);
}

void TestConfigFollowsLiveBusCount() {
  kitbag::Mixer mixer(kSampleRate);
  LoadMutedTones(&mixer);
  mixer.Play();
  RenderPaced(&mixer, kSettleBlocks);
  Check(mixer.key_bus_count() == kChosenBuses, "config: four buses live");
  CheckState(&mixer, kChosenBuses - 1, LagFrames(kSpeed), "config: chosen");
  mixer.SetTrackPitch(kExtraStem, kFifthKey, kZeroClock, false);
  Check(mixer.key_bus_count() == kStems, "config: a fifth bus is live");
  CheckState(
      &mixer,
      kExtraStem,
      VendorDefaultLagFrames(kSpeed),
      "config: five buses run presetDefault"
  );
  mixer.SetTrackPitch(kExtraStem, 0.0f, kZeroClock, false);
  RenderPaced(&mixer, kSettleBlocks);
  Check(
      mixer.key_buses_vendor_default(),
      "config: four keys in use mid-play stay on presetDefault"
  );
  mixer.Seek(mixer.position(), kZeroClock, false);
  Check(mixer.key_bus_count() == kChosenBuses, "config: back to four buses");
  CheckState(
      &mixer,
      kChosenBuses - 1,
      LagFrames(kSpeed),
      "config: back down to the chosen config"
  );
}

int64_t ClockAcrossSwitch(bool up) {
  kitbag::Mixer mixer(kSampleRate);
  const int64_t burst = kSeekTo + kBurstAfterSeek;
  LoadStems(
      &mixer,
      ToneFixture({.frames = kSongFrames, .burst_at = burst}),
      ToneFixture({.frames = kSongFrames})
  );
  if (!up) {
    mixer.SetTrackPitch(kExtraStem, kFifthKey, kZeroClock, false);
  }
  mixer.Seek(kSeekTo, kZeroClock, false);
  mixer.Play();
  RenderPaced(&mixer, kSwitchAtBlock);
  if (up) {
    mixer.SetTrackPitch(kExtraStem, kFifthKey, kZeroClock, false);
  } else {
    mixer.SetTrackPitch(kExtraStem, 0.0f, kZeroClock, false);
    mixer.Seek(mixer.position(), kZeroClock, false);
  }
  return SongFrameAtOnset(&mixer, kOnsetBlocks);
}

void TestSwitchKeepsTheClock() {
  const int64_t burst = kSeekTo + kBurstAfterSeek;
  CheckNear(
      ClockAcrossSwitch(true),
      burst,
      kOnsetToleranceFrames,
      "config: after switching up mid-play the clock lands a transient"
  );
  CheckNear(
      ClockAcrossSwitch(false),
      burst,
      kOnsetToleranceFrames,
      "config: after switching down at a seek the clock lands a transient"
  );
}

}  // namespace

void RunConfigTests() {
  TestConfigFollowsLiveBusCount();
  TestSwitchKeepsTheClock();
}

}  // namespace mixer_test
