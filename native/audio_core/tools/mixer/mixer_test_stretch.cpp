#include "mixer_test_stretch_support.h"

namespace mixer_test {
namespace {

constexpr float kCarryRate = 0.625f;
constexpr uint32_t kOddBlock = 441;
constexpr int kCarryBlocks = 997;
constexpr int64_t kCarrySongFrames = 7 * kSampleRate;
constexpr int64_t kBypassSeek = 3001;
constexpr int64_t kDisengageSeek = 9001;
constexpr int kEngageBlocks = 2;
constexpr float kSpeed = 0.75f;
constexpr float kSlow = 0.5f;
constexpr float kKey = 2.0f;
constexpr int64_t kToneFrames = 4 * kSampleRate;
constexpr int kSettleBlocks = 40;
constexpr int kLatencyBlocks = 50;
constexpr int64_t kLoopStart = 20011;
constexpr int64_t kLoopEnd = 47123;
constexpr int64_t kLoopFrom = 40000;
constexpr int kOverPitch = 9;
constexpr float kUnderRate = 0.1f;
constexpr float kOverRate = 2.0f;
constexpr int kDrainBlocks = 60;
constexpr int kAllocBlocks = 50;

void TestTakeAndCarrySum() {
  kitbag::Mixer mixer(kSampleRate);
  LoadPcm(&mixer, 0, ToneFixture({.frames = kCarrySongFrames}));
  mixer.SetRate(kCarryRate, 0, false);
  mixer.Play();
  const int64_t before = mixer.fed_frames();
  std::vector<float> out(static_cast<size_t>(kOddBlock) * 2);
  for (int b = 0; b < kCarryBlocks; ++b) mixer.Process(out.data(), kOddBlock);
  const auto takes = static_cast<int64_t>(
      std::floor(static_cast<double>(kCarryRate) * kOddBlock * kCarryBlocks)
  );
  CheckNear(
      mixer.fed_frames() - before,
      LagFrames(kCarryRate) + takes,
      0,
      "carry: the pre-roll plus every take sums to floor(rate * frames)"
  );
}

void TestBypassIsSampleExact() {
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, kLoopTrackFrames, 0.0f);
  mixer.SetRate(kitbag::Mixer::kMaxRate, 0, false);
  mixer.SetTrackPitch(0, 0.0f, 0, false);
  mixer.Seek(kBypassSeek, 0, false);
  mixer.Play();
  std::vector<float> left = RenderPaced(&mixer, 1);
  ExpectAt(left, 0, kBypassSeek, "bypass: 1.0x at 0 st has zero lag");
  Check(!mixer.stretch_engaged(), "bypass: nothing is engaged");
  Check(mixer.key_bus_count() == 0, "bypass: no key bus is configured");
  mixer.SetRate(kSpeed, 0, false);
  RenderPaced(&mixer, kEngageBlocks);
  Check(mixer.stretch_engaged(), "engage: 0.75x engages mid-play");
  mixer.SetRate(kitbag::Mixer::kMaxRate, 0, false);
  RenderPaced(&mixer, 1);
  Check(mixer.stretch_engaged(), "engage: back at 1.0x it holds until a seek");
  mixer.Seek(kDisengageSeek, 0, false);
  left = RenderPaced(&mixer, 1);
  ExpectAt(left, 0, kDisengageSeek, "disengage: the seek is frame for frame");
  Check(!mixer.stretch_engaged(), "disengage: a seek at 1.0x, 0 st bypasses");
}

int64_t ControlLatency(float rate, float key) {
  kitbag::Mixer mixer(kSampleRate);
  LoadPcm(
      &mixer,
      0,
      ToneFixture({.frames = kToneFrames, .steady_hz = kBurstHz})
  );
  mixer.SetRate(rate, 0, false);
  mixer.SetTrackPitch(0, key, 0, false);
  mixer.SetMute(0, true);
  mixer.Play();
  std::vector<float> left = RenderPaced(&mixer, kSettleBlocks);
  const auto unmuted = static_cast<int64_t>(left.size());
  mixer.SetMute(0, false);
  const std::vector<float> after = RenderPaced(&mixer, kLatencyBlocks);
  left.insert(left.end(), after.begin(), after.end());
  const int64_t onset = FirstAbove(left, kOnsetThreshold, unmuted);
  return onset == kNotFound ? kNotFound : onset - unmuted;
}

void CheckControlLatency(const char* state, float rate, float key) {
  const bool bypass = rate == kitbag::Mixer::kMaxRate && key == 0.0f;
  const int64_t expected = bypass ? 0 : OutputFramesFor(LagFrames(rate), rate);
  const int64_t got = ControlLatency(rate, key);
  std::printf(
      "mixer_verify: control latency %s: %lld frames (%.1f ms), "
      "expected %lld\n",
      state,
      static_cast<long long>(got),
      Ms(got),
      static_cast<long long>(expected)
  );
  CheckNear(got, expected, kOnsetToleranceFrames, state);
}

void TestControlLatencyPerState() {
  CheckControlLatency("bypass", kitbag::Mixer::kMaxRate, 0.0f);
  CheckControlLatency("1.0x +2 st", kitbag::Mixer::kMaxRate, kKey);
  CheckControlLatency("0.75x", kSpeed, 0.0f);
  CheckControlLatency("0.5x", kSlow, 0.0f);
}

void TestEngageTransition() {
  const std::vector<float> tone =
      ToneFixture({.frames = kToneFrames, .steady_hz = kBurstHz});
  const float budget = LoopWrapCurvature(
      {tone},
      {.start = kLoopStart, .end = kLoopEnd, .from = kLoopFrom}
  );
  kitbag::Mixer mixer(kSampleRate);
  LoadPcm(&mixer, 0, tone);
  mixer.Play();
  std::vector<float> left = RenderPaced(&mixer, kSettleBlocks);
  const uint64_t head = mixer.position();
  const auto seam = static_cast<int64_t>(left.size());
  mixer.SetRate(kSpeed, 0, false);
  const std::vector<float> after = RenderPaced(&mixer, 1);
  left.insert(left.end(), after.begin(), after.end());
  Check(mixer.stretch_engaged(), "engage: the first block after is engaged");
  CheckNear(
      static_cast<int64_t>(mixer.position() - head),
      static_cast<int64_t>(kSpeed * kBlock),
      1,
      "engage: the position runs on at 0.75x without a jump"
  );
  const float click = PeakCurvature(left, seam - kBlock, seam + kBlock);
  std::printf(
      "mixer_verify: engage seam curvature %.5f, loop crossfade %.5f\n",
      static_cast<double>(click),
      static_cast<double>(budget)
  );
  Check(click <= budget, "engage: the seam clicks no more than a loop wrap");
}

void CheckSoundsAtOnce(kitbag::Mixer* mixer, const char* label) {
  const std::vector<float> first = RenderPaced(mixer, 1);
  const float peak = Loudest(first, mixer->crossfade_frames(), kBlock);
  Check(peak > kOnsetThreshold, label);
  if (peak <= kOnsetThreshold) {
    std::fprintf(
        stderr,
        "  first-block peak %.3f\n",
        static_cast<double>(peak)
    );
  }
}

void TestPrimeLeavesNoGap() {
  kitbag::Mixer mixer(kSampleRate);
  LoadPcm(
      &mixer,
      0,
      ToneFixture({.frames = kToneFrames, .steady_hz = kBurstHz})
  );
  mixer.Play();
  RenderPaced(&mixer, kSettleBlocks);
  mixer.SetRate(kSpeed, 0, false);
  CheckSoundsAtOnce(&mixer, "prime: engaging mid-play leaves no gap");
  mixer.Seek(kLoopFrom, 0, false);
  CheckSoundsAtOnce(&mixer, "prime: a seek sounds at once");
  mixer.Stop(0, false);
  Drain(&mixer);
  mixer.Play();
  CheckSoundsAtOnce(&mixer, "prime: play from stop sounds at once");
}

void TestBusesAreLazyAndFreed() {
  kitbag::Mixer mixer(kSampleRate);
  for (int t : {0, 1}) LoadPcm(&mixer, t, ToneFixture({.frames = kToneFrames}));
  Check(mixer.key_bus_count() == 0, "buses: none before a stage engages");
  mixer.SetRate(kSpeed, 0, false);
  Check(mixer.key_bus_count() == 1, "buses: speed alone needs one");
  mixer.SetTrackPitch(1, kKey, 0, false);
  Check(mixer.key_bus_count() == 2, "buses: one per distinct semitone");
  mixer.SetTrackPitch(0, static_cast<float>(kOverPitch), 0, false);
  Drain(&mixer);
  Check(
      mixer.track_pitch(0) == kitbag::Mixer::kMaxPitchSemitones,
      "buses: pitch clamps to +6"
  );
  mixer.SetTrackPitch(0, 0.0f, 0, false);
  mixer.SetTrackPitch(1, 0.0f, 0, false);
  Check(mixer.key_bus_count() == 3, "buses: a move frees nothing mid-play");
  mixer.Seek(0, 0, false);
  Check(mixer.key_bus_count() == 1, "buses: a seek frees the unused ones");
  mixer.SetRate(kUnderRate, 0, false);
  Drain(&mixer);
  Check(mixer.rate() == kitbag::Mixer::kMinRate, "rate: clamps to 0.5");
  mixer.SetRate(kOverRate, 0, false);
  Drain(&mixer);
  Check(mixer.rate() == kitbag::Mixer::kMaxRate, "rate: clamps to 1.0");
  for (int t : {0, 1}) mixer.UnloadTrack(t, 0, false);
  Check(mixer.key_bus_count() == 0, "buses: unloading the song frees all");
}

size_t CountedProcess(kitbag::Mixer* mixer, int blocks) {
  std::vector<float> out(static_cast<size_t>(kBlock) * 2);
  size_t allocations = 0;
  for (int b = 0; b < blocks; ++b) {
    WaitForReadAhead(*mixer);
    const size_t before = ThreadAllocations();
    mixer->Process(out.data(), kBlock);
    allocations += ThreadAllocations() - before;
  }
  return allocations;
}

void TestProcessNeverAllocates() {
  const size_t probe_before = ThreadAllocations();
  const std::vector<float> probe(kBlock);
  Check(
      ThreadAllocations() > probe_before && !probe.empty(),
      "alloc: the counter sees this thread's allocations"
  );
  kitbag::Mixer mixer(kSampleRate);
  for (int t : {0, 1, 2}) {
    LoadPcm(&mixer, t, ToneFixture({.frames = kToneFrames, .bed = true}));
  }
  mixer.SetTrackPitch(1, kKey, 0, false);
  mixer.SetTrackPitch(2, -kKey, 0, false);
  mixer.Play();
  size_t allocations = CountedProcess(&mixer, kAllocBlocks);
  mixer.SetRate(kSpeed, 0, false);
  allocations += CountedProcess(&mixer, kAllocBlocks);
  mixer.SetTrackPitch(1, -kKey, 0, false);
  allocations += CountedProcess(&mixer, kDrainBlocks);
  mixer.SetTrackPitch(1, kKey, 0, false);
  mixer.Seek(kLoopFrom, 0, false);
  allocations += CountedProcess(&mixer, kAllocBlocks);
  Check(
      allocations == 0,
      "alloc: Process with live buses (engage, rate, move, wake, prime)"
  );
}

}  // namespace

void RunStretchTests() {
  TestTakeAndCarrySum();
  TestBypassIsSampleExact();
  TestControlLatencyPerState();
  TestEngageTransition();
  TestPrimeLeavesNoGap();
  TestBusesAreLazyAndFreed();
  TestProcessNeverAllocates();
}

}  // namespace mixer_test
