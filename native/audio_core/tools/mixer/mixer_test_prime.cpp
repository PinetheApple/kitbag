#include <ctime>
#include <thread>

#include "mixer_test_stretch_support.h"

namespace mixer_test {
namespace {

constexpr float kSpeed = 0.75f;
constexpr int kGateStems = 8;
constexpr int64_t kSongFrames = int64_t{6} * kSampleRate;
constexpr int64_t kSeekTo = int64_t{2} * kSampleRate + 11;
constexpr int kEventBlocks = 3;
// The callback's own CPU time, so other load cannot inflate it; half the
// block leaves room for a slower CI host.
constexpr double kBudgetShare = 0.5;
constexpr double kUsPerSecond = 1e6;
constexpr float kAlignKey = 2.0f;
constexpr int kAlignBlocks = 120;
constexpr float kCancelFloor = 1e-6f;
constexpr int64_t kMissBurst = int64_t{3} * kSampleRate / 2 + 13;
constexpr auto kMissPeriod = std::chrono::microseconds(2667);
constexpr auto kMissSettle = std::chrono::milliseconds(50);
constexpr auto kMissRun = std::chrono::milliseconds(1500);
constexpr int64_t kRingSongFrames = 30011;
constexpr auto kFillTimeout = std::chrono::seconds(1);
constexpr auto kFillPoll = std::chrono::microseconds(500);

struct GateCase {
  int buses;
  bool vendor;
  const char* engaged;
  const char* label;
};

constexpr GateCase kGateCases[] = {
    {1, false, "prime: 1 bus engages", "prime: 1 bus, worst block in budget"},
    {4,
     false,
     "prime: 4 buses engage on the chosen config",
     "prime: 4 buses chosen, worst block in budget"},
    {5,
     true,
     "prime: 5 buses engage on presetDefault",
     "prime: 5 buses presetDefault, worst block in budget"},
};

double ThreadSeconds() {
  timespec now{};
  clock_gettime(CLOCK_THREAD_CPUTIME_ID, &now);
  return static_cast<double>(now.tv_sec) +
         static_cast<double>(now.tv_nsec) / (kUsPerSecond * kMsPerSecond);
}

double WorstBlock(kitbag::Mixer* mixer, int blocks) {
  std::vector<float> out(static_cast<size_t>(kBlock) * 2);
  double worst = 0.0;
  for (int b = 0; b < blocks; ++b) {
    WaitForReadAhead(*mixer);
    const double start = ThreadSeconds();
    mixer->Process(out.data(), kBlock);
    worst = std::max(worst, ThreadSeconds() - start);
  }
  return worst;
}

void SetKeys(kitbag::Mixer* mixer, int buses) {
  for (int t = 0; t < kGateStems; ++t) {
    mixer->SetTrackPitch(t, static_cast<float>(t % buses), 0, false);
  }
  mixer->SetRate(kSpeed, 0, false);
}

void CheckGateCase(const GateCase& gate, const std::vector<float>& pcm) {
  kitbag::Mixer mixer(kSampleRate);
  for (int t = 0; t < kGateStems; ++t) LoadPcm(&mixer, t, pcm);
  mixer.Play();
  RenderPaced(&mixer, kEventBlocks);
  SetKeys(&mixer, gate.buses);
  const double engage = WorstBlock(&mixer, HandOverBlocks(mixer));
  Check(
      mixer.stretch_engaged() &&
          mixer.key_buses_vendor_default() == gate.vendor,
      gate.engaged
  );
  mixer.Seek(kSeekTo, 0, false);
  const double seek = WorstBlock(&mixer, kEventBlocks);
  mixer.Stop(0, false);
  mixer.Play();
  const double play = WorstBlock(&mixer, kEventBlocks);
  const double budget = kBudgetShare * kBlock / kSampleRate;
  std::printf(
      "mixer_verify: %s: engage %.0f, seek %.0f, play %.0f us CPU, bound "
      "%.0f\n",
      gate.label,
      kUsPerSecond * engage,
      kUsPerSecond * seek,
      kUsPerSecond * play,
      kUsPerSecond * budget
  );
  Check(std::max({engage, seek, play}) <= budget, gate.label);
}

void TestPrimeStaysInBudget() {
  const std::vector<float> pcm =
      ToneFixture({.frames = kSongFrames, .bed = true});
  for (const GateCase& gate : kGateCases) CheckGateCase(gate, pcm);
}

float AlignedPeak(bool handover, bool inverted) {
  const std::vector<float> pcm =
      ToneFixture({.frames = kSongFrames, .burst_at = kSeekTo, .bed = true});
  std::vector<float> negative(pcm);
  for (float& v : negative) v = -v;
  kitbag::Mixer mixer(kSampleRate);
  LoadPcm(&mixer, 0, pcm);
  if (inverted) LoadPcm(&mixer, 1, negative);
  mixer.Seek(kSeekTo - (handover ? kSampleRate / 2 : 0), 0, false);
  if (handover) {
    mixer.Play();
    RenderPaced(&mixer, kEventBlocks);
  }
  for (int t = 0; t < mixer.active_track_count(); ++t) {
    mixer.SetTrackPitch(t, kAlignKey, 0, false);
  }
  mixer.SetRate(kSpeed, 0, false);
  if (!handover) mixer.Play();
  const std::vector<float> left = RenderPaced(&mixer, kAlignBlocks);
  return mixer.stretch_engaged()
             ? Loudest(left, 0, static_cast<int64_t>(left.size()))
             : kOnsetThreshold;
}

void TestStemsStaySampleAligned() {
  Check(
      AlignedPeak(false, false) > kOnsetThreshold,
      "align: the control without the inverted stem is loud"
  );
  Check(
      AlignedPeak(false, true) <= kCancelFloor,
      "align: a stem and its inverse cancel after an app-thread seek prime"
  );
  Check(
      AlignedPeak(true, true) <= kCancelFloor,
      "align: a stem and its inverse cancel across a mid-play hand-over"
  );
}

void RenderRealTime(
    kitbag::Mixer* mixer,
    const std::atomic<bool>& stop,
    ClockedRender* run,
    bool* backwards
) {
  std::vector<float> out(static_cast<size_t>(kBlock) * 2);
  auto next = std::chrono::steady_clock::now();
  while (!stop.load()) {
    const uint64_t last = mixer->position();
    mixer->Process(out.data(), kBlock);
    AppendLeft(&run->left, out, kBlock);
    const kitbag::SongClock& clock = mixer->song_clock();
    for (uint32_t i = 0; i < kBlock; ++i) {
      run->song.push_back(i < clock.frames ? clock.SongFrameAt(i) : kNotFound);
    }
    *backwards = *backwards || mixer->position() < last;
    next += kMissPeriod;
    std::this_thread::sleep_until(next);
  }
}

bool EngageWhileRendering(kitbag::Mixer* mixer, ClockedRender* run) {
  std::atomic<bool> stop{false};
  bool backwards = false;
  std::thread render(RenderRealTime, mixer, std::cref(stop), run, &backwards);
  std::this_thread::sleep_for(kMissSettle);
  mixer->set_first_handover_lead_frames(-int64_t{kBlock});
  mixer->SetRate(kSpeed, 0, true);
  std::this_thread::sleep_for(kMissRun);
  stop.store(true);
  render.join();
  return backwards;
}

void TestMissedHandOverRePrimes() {
  kitbag::Mixer mixer(kSampleRate);
  LoadPcm(
      &mixer,
      0,
      ToneFixture({.frames = kSongFrames, .burst_at = kMissBurst, .bed = true})
  );
  mixer.Play();
  ClockedRender run;
  const bool backwards = EngageWhileRendering(&mixer, &run);
  Check(
      mixer.missed_handovers() >= 1,
      "handover: a passed switch point is refused"
  );
  Check(mixer.stretch_engaged(), "handover: a re-prime at a new point engages");
  Check(!backwards, "handover: never adopted late, the head never steps back");
  const int64_t onset = FirstAbove(run.left, kOnsetThreshold);
  CheckNear(
      onset == kNotFound ? kNotFound : run.song[onset],
      kMissBurst,
      kOnsetToleranceFrames,
      "handover: a transient after the re-prime lands on its frame"
  );
}

// The song fits one ring, so once it has filled, what the source has handed
// out is its length minus what it holds, which must equal what was fed.
int64_t SourceAheadOfFed(const kitbag::Mixer& mixer) {
  const auto handed_out = [&mixer] {
    return static_cast<int64_t>(
        mixer.track_frames(0) - mixer.track_buffered(0)
    );
  };
  const auto deadline = std::chrono::steady_clock::now() + kFillTimeout;
  while (handed_out() > mixer.fed_frames() &&
         std::chrono::steady_clock::now() < deadline) {
    std::this_thread::sleep_for(kFillPoll);
  }
  return handed_out() - mixer.fed_frames();
}

void TestSourcesResumeAfterPreRoll() {
  const std::vector<float> pcm = ToneFixture({.frames = kRingSongFrames});
  kitbag::Mixer primed(kSampleRate);
  LoadPcm(&primed, 0, pcm);
  primed.SetRate(kSpeed, 0, false);
  primed.Play();
  RenderPaced(&primed, kEventBlocks);
  CheckNear(
      SourceAheadOfFed(primed),
      0,
      0,
      "prime: a source resumes on the frame after a play prime's pre-roll"
  );
  kitbag::Mixer handed(kSampleRate);
  LoadPcm(&handed, 0, pcm);
  handed.Play();
  RenderPaced(&handed, kEventBlocks);
  handed.SetRate(kSpeed, 0, false);
  RenderPaced(&handed, HandOverBlocks(handed));
  Check(handed.stretch_engaged(), "handover: engages within the lead");
  CheckNear(
      SourceAheadOfFed(handed),
      0,
      0,
      "handover: a source resumes on the frame after the bank's pre-roll"
  );
}

}  // namespace

void RunPrimeTests() {
  TestPrimeStaysInBudget();
  TestStemsStaySampleAligned();
  TestMissedHandOverRePrimes();
  TestSourcesResumeAfterPreRoll();
}

}  // namespace mixer_test
