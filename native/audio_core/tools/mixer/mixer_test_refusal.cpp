#include <filesystem>
#include <string>
#include <vector>

#include "mixer_test_stretch_support.h"

namespace mixer_test {
namespace {

using Result = kitbag::Mixer::StretchResult;

constexpr float kSpeed = 0.75f;
constexpr float kKey = 3.0f;
constexpr float kQuiet = 0.1f;
constexpr double kQuietHz = 330.0;
constexpr int64_t kToneFrames = int64_t{6} * kSampleRate;
constexpr int64_t kSeekTo = kSampleRate + 7;
constexpr int kSettleBlocks = 40;
constexpr int kFragileTrack = 1;
constexpr int kFifthKeyTrack = 4;

std::string PlayFourKeysReturningFifthStem(kitbag::Mixer* mixer) {
  LoadTone(mixer, kToneFrames);
  std::string fifth;
  for (int t = 1; t <= kFifthKeyTrack; ++t) {
    fifth = LoadSilence(mixer, t, kToneFrames);
  }
  for (int t = 1; t < kFifthKeyTrack; ++t) {
    mixer->SetTrackPitch(t, static_cast<float>(t), 0, false);
  }
  mixer->Play();
  RenderPaced(mixer, kSettleBlocks);
  return fifth;
}

void TestStoppedPrimeFailureChangesNothing() {
  kitbag::Mixer mixer(kSampleRate);
  const std::string fragile =
      LoadToneOverFragile(&mixer, kFragileTrack, kToneFrames);
  Hide(fragile);
  Check(
      mixer.SetRate(kSpeed, 0, false) == Result::kPrimeFailed,
      "refusal: a failed prime fails the rate"
  );
  Check(
      mixer.SetTrackPitch(0, kKey, 0, false) == Result::kPrimeFailed,
      "refusal: a failed prime fails the key"
  );
  RenderPaced(&mixer, 1);
  Check(
      mixer.rate() == kitbag::kUnityRate,
      "refusal: the rate mirror keeps the old rate"
  );
  Check(mixer.track_pitch(0) == 0, "refusal: the key mirror keeps the old key");
  Unhide(fragile);
  LoadSilence(&mixer, kFragileTrack + 1, kToneFrames);
  Check(
      mixer.key_bus_count() == 0,
      "refusal: a failed prime leaves the mixer not engaged"
  );
  Check(
      mixer.SetRate(kSpeed, 0, false) == Result::kOk,
      "refusal: the rate applies once the file is back"
  );
}

void TestPlayingPrimeFailureStaysInBypass() {
  kitbag::Mixer mixer(kSampleRate);
  const std::string fragile =
      LoadToneOverFragile(&mixer, kFragileTrack, kToneFrames);
  mixer.Play();
  RenderPaced(&mixer, kSettleBlocks);
  Hide(fragile);
  Check(
      mixer.SetRate(kSpeed, 0, false) == Result::kPrimeFailed,
      "refusal: a failed hand-over fails the rate"
  );
  const uint64_t before = mixer.position();
  const int blocks = HandOverBlocks(mixer);
  const std::vector<float> left = RenderPaced(&mixer, blocks);
  Check(!mixer.stretch_engaged(), "refusal: a failed hand-over never engages");
  CheckNear(
      static_cast<int64_t>(mixer.position() - before),
      int64_t{blocks} * kBlock,
      0,
      "refusal: the song runs on at 1.0x"
  );
  CheckNoQuietWindow(left, 0, "refusal: playback runs on");
  Unhide(fragile);
}

void TestEngagedFlipFailureKeepsTheConfig() {
  kitbag::Mixer mixer(kSampleRate);
  const std::string fifth = PlayFourKeysReturningFifthStem(&mixer);
  Hide(fifth);
  const float key = static_cast<float>(kFifthKeyTrack);
  Check(
      mixer.SetTrackPitch(kFifthKeyTrack, key, 0, false) ==
          Result::kPrimeFailed,
      "refusal: a failed config flip fails the key"
  );
  Check(
      !mixer.key_buses_vendor_default(),
      "refusal: a failed config flip keeps the chosen config"
  );
  const std::vector<float> left = RenderPaced(&mixer, kSettleBlocks);
  Check(
      mixer.track_pitch(kFifthKeyTrack) == 0,
      "refusal: a failed config flip keeps the stem's key"
  );
  CheckNoQuietWindow(left, 0, "refusal: a failed config flip keeps sounding");
  Unhide(fifth);
  Check(
      mixer.SetTrackPitch(kFifthKeyTrack, key, 0, false) == Result::kOk &&
          mixer.key_buses_vendor_default(),
      "refusal: the flip applies once the file is back"
  );
}

void TestStalledHandOverThenFailureIsRetracted() {
  kitbag::Mixer mixer(kSampleRate);
  const std::string fragile =
      LoadToneOverFragile(&mixer, kFragileTrack, kToneFrames);
  mixer.Play();
  RenderPaced(&mixer, kSettleBlocks);
  mixer.set_prime_publish_hook([&fragile] {
    std::filesystem::remove(fragile);
  });
  Check(
      mixer.SetRate(kSpeed, 0, true) == Result::kPrimeFailed,
      "refusal: a stalled hand-over whose jump fails fails the rate"
  );
  mixer.set_prime_publish_hook({});
  const std::vector<float> left =
      RenderPaced(&mixer, HandOverBlocks(mixer) + kSettleBlocks);
  Check(
      !mixer.stretch_engaged(),
      "refusal: a refused rate's hand-over never lands"
  );
  Check(
      mixer.rate() == kitbag::kUnityRate,
      "refusal: the stall keeps the rate"
  );
  CheckNoQuietWindow(left, 0, "refusal: playback runs on past the stall");
}

void TestUndoSlotIsReserved() {
  int capacity = 0;
  {
    kitbag::Mixer probe(kSampleRate);
    LoadTone(&probe, kToneFrames);
    probe.SetGain(0, 1.0f);
    while (probe.dropped_commands() == 0) {
      ++capacity;
      probe.SetGain(0, 1.0f);
    }
  }
  kitbag::Mixer mixer(kSampleRate);
  const std::string fragile =
      LoadToneOverFragile(&mixer, kFragileTrack, kToneFrames);
  Hide(fragile);
  for (int i = 0; i < capacity - 1; ++i) mixer.SetGain(0, 1.0f);
  Check(
      mixer.SetRate(kSpeed, 0, false) == Result::kBusy,
      "refusal: one free slot is too few to undo a rate"
  );
  RenderPaced(&mixer, 1);
  Check(mixer.rate() == kitbag::kUnityRate, "refusal: busy keeps the rate");
  Unhide(fragile);
}

void TestFailedSeekDropsWhatItStaged() {
  kitbag::Mixer mixer(kSampleRate);
  LoadTone(&mixer, kToneFrames);
  LoadPcm(
      &mixer,
      kFragileTrack,
      ToneFixture(
          {.frames = kToneFrames,
           .steady_hz = kQuietHz,
           .steady_amplitude = kQuiet}
      )
  );
  const std::string fragile = TempFiles().back();
  mixer.Play();
  RenderPaced(&mixer, kSettleBlocks);
  Hide(fragile);
  mixer.Seek(kSeekTo, 0, false);
  RenderPaced(&mixer, kSettleBlocks);
  Unhide(fragile);
  mixer.SetRate(kSpeed, 0, false);
  RenderPaced(&mixer, HandOverBlocks(mixer) + kSettleBlocks);
  const std::vector<float> left = RenderPaced(&mixer, kSettleBlocks);
  const float peak = Loudest(left, 0, static_cast<int64_t>(left.size()));
  Check(
      peak > kOnsetThreshold,
      "refusal: a failed seek leaves the loud stem for the next hand-over"
  );
  if (peak <= kOnsetThreshold) {
    std::fprintf(stderr, "  peak %.3f\n", static_cast<double>(peak));
  }
}

void TestBusyInBypassLeavesItNotEngaged() {
  kitbag::Mixer mixer(kSampleRate);
  LoadTone(&mixer, kToneFrames);
  FillCommandQueue(&mixer);
  Check(
      mixer.SetTrackPitch(0, kKey, 0, false) == Result::kBusy,
      "busy: a full queue refuses the key"
  );
  RenderPaced(&mixer, 1);
  LoadSilence(&mixer, kFragileTrack, kToneFrames);
  Check(mixer.key_bus_count() == 0, "busy: the refused key engages nothing");
  Check(mixer.track_pitch(0) == 0, "busy: the key mirror keeps the old key");
}

void TestBusyEngagedPublishesNoBus() {
  kitbag::Mixer mixer(kSampleRate);
  LoadToneOverFragile(&mixer, kFragileTrack, kToneFrames);
  mixer.SetRate(kSpeed, 0, false);
  mixer.Play();
  RenderPaced(&mixer, kSettleBlocks);
  const int before = mixer.key_bus_count();
  FillCommandQueue(&mixer);
  Check(
      mixer.SetTrackPitch(kFragileTrack, kKey, 0, false) == Result::kBusy,
      "busy: a full queue refuses a live key"
  );
  Check(mixer.key_bus_count() == before, "busy: a refused key adds no bus");
}

void TestBusyKeepsTheConfig() {
  kitbag::Mixer mixer(kSampleRate);
  PlayFourKeysReturningFifthStem(&mixer);
  FillCommandQueue(&mixer);
  mixer.SetTrackPitch(
      kFifthKeyTrack,
      static_cast<float>(kFifthKeyTrack),
      0,
      false
  );
  Check(
      !mixer.key_buses_vendor_default(),
      "busy: a refused fifth key keeps the chosen config"
  );
}

}  // namespace

void RunRefusalTests() {
  TestStoppedPrimeFailureChangesNothing();
  TestPlayingPrimeFailureStaysInBypass();
  TestEngagedFlipFailureKeepsTheConfig();
  TestStalledHandOverThenFailureIsRetracted();
  TestUndoSlotIsReserved();
  TestFailedSeekDropsWhatItStaged();
  TestBusyInBypassLeavesItNotEngaged();
  TestBusyEngagedPublishesNoBus();
  TestBusyKeepsTheConfig();
}

}  // namespace mixer_test
