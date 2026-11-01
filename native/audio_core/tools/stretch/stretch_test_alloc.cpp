#include <memory>
#include <random>
#include <vector>

#include "stretch_test_support.h"

namespace stretch_test {
namespace {

constexpr double kRates[] = {0.5, 0.75, 1.0};
constexpr float kShifts[] = {-6.0f, -1.0f, 0.0f, 1.0f, 6.0f};
constexpr int kShiftCount = sizeof(kShifts) / sizeof(kShifts[0]);
constexpr int kLargeBlockFrames = 4096;
constexpr int kBlockSizes[] = {1, kBlockFrames, kLargeBlockFrames};
constexpr int kScenarioFrames = kSampleRate;
constexpr int kInputFrames = 2 * kSampleRate;
constexpr float kNoiseAmplitude = 0.3f;
constexpr int kWideAlignment = 64;
constexpr int kProbeFloats = 16;
// Escape the probes so the compiler cannot elide their allocations.
float* volatile g_probe_sink = nullptr;
void* volatile g_wide_sink = nullptr;

struct alignas(kWideAlignment) Wide {
  float values[kProbeFloats];
};

struct Inputs {
  std::vector<float> tone;
  std::vector<float> silence;
  std::vector<float> noise;
};

Inputs MakeInputs() {
  Inputs inputs;
  inputs.tone = ToneBurst({.tone_frames = kInputFrames}, kToneHz);
  inputs.silence.assign(kInputFrames * kChannels, 0.0f);
  std::minstd_rand engine(1);
  std::uniform_real_distribution<float> sample(
      -kNoiseAmplitude,
      kNoiseAmplitude
  );
  inputs.noise.resize(kInputFrames * kChannels);
  for (float& s : inputs.noise) s = sample(engine);
  return inputs;
}

void RunScenario(
    kitbag::TimeStretch& stretch,
    const std::vector<float>& in,
    float* out,
    int block_frames,
    double rate
) {
  InputStepper stepper(rate, block_frames);
  int pos = 0;
  for (int done = 0; done < kScenarioFrames; done += block_frames) {
    const int take = stepper.Next();
    stretch.Process(&in[pos * kChannels], take, out, block_frames);
    pos += take;
  }
}

void TestProcessDoesNotAllocate(const Inputs& inputs) {
  kitbag::TimeStretch stretch;
  stretch.Configure(kChannels, kSampleRate);
  std::vector<float> out(kLargeBlockFrames * kChannels);
  const std::size_t before = AllocationCount();
  int shift = 0;
  for (const auto* in : {&inputs.tone, &inputs.silence, &inputs.noise}) {
    for (int block_frames : kBlockSizes) {
      for (double rate : kRates) {
        stretch.SetTransposeSemitones(kShifts[shift++ % kShiftCount]);
        RunScenario(stretch, *in, out.data(), block_frames, rate);
      }
    }
  }
  Check(
      AllocationCount() == before,
      "Process and SetTransposeSemitones never allocate: tone, silence, "
      "noise; 1, 480 and 4096-frame blocks"
  );
}

void TestResetAndSeekDoNotAllocate(const Inputs& inputs) {
  kitbag::TimeStretch stretch;
  stretch.Configure(kChannels, kSampleRate);
  std::vector<float> out(kBlockFrames * kChannels);
  RunScenario(stretch, inputs.tone, out.data(), kBlockFrames, 1.0);
  const std::size_t before = AllocationCount();
  stretch.Reset();
  stretch.Seek(inputs.noise.data(), stretch.SeekFrames(), kRates[1]);
  RunScenario(stretch, inputs.tone, out.data(), kBlockFrames, kRates[1]);
  Check(AllocationCount() == before, "Reset and Seek never allocate");
}

void TestCounterSeesAllocations() {
  std::size_t before = AllocationCount();
  std::vector<float> probe(kBlockFrames);
  g_probe_sink = probe.data();
  Check(AllocationCount() > before, "allocation counter counts operator new");
  before = AllocationCount();
  const std::unique_ptr<float[]> array(new float[kProbeFloats]);
  g_probe_sink = array.get();
  Check(AllocationCount() > before, "allocation counter counts new[]");
  before = AllocationCount();
  const auto wide = std::make_unique<Wide>();
  g_wide_sink = wide.get();
  Check(AllocationCount() > before, "allocation counter counts aligned new");
}

}  // namespace

void RunAllocationTests() {
  TestCounterSeesAllocations();
  const Inputs inputs = MakeInputs();
  TestProcessDoesNotAllocate(inputs);
  TestResetAndSeekDoNotAllocate(inputs);
}

}  // namespace stretch_test
