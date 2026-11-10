#include "mixer_test_stretch_support.h"

namespace mixer_test {
namespace {

constexpr float kRampOffset = 1000.0f;
constexpr uint64_t kRampFrames = 40000;
constexpr uint64_t kHead = 5003;
constexpr uint64_t kOtherHead = 9011;
// Off the block grid, so a start applied at the block's first frame is early.
constexpr uint32_t kLead = 301;
constexpr int kStartBlock = 7;
constexpr uint64_t kStartFrame = uint64_t{kStartBlock} * kBlock + kLead;
constexpr uint64_t kLaterStart = kStartFrame + 3 * kBlock + 17;
constexpr int kRunBlocks = 16;
constexpr float kSpeed = 0.75f;
constexpr int64_t kToneFrames = int64_t{3} * kSampleRate;
constexpr int64_t kBurstLead = 2400;

struct Run {
  kitbag::Mixer* mixer = nullptr;
  uint64_t frame = 0;
  std::vector<float> left;
  size_t allocations = 0;
};

void Render(Run* run, int blocks) {
  std::vector<float> out(static_cast<size_t>(kBlock) * 2);
  for (int b = 0; b < blocks; ++b) {
    WaitForReadAhead(*run->mixer);
    const size_t before = ThreadAllocations();
    run->mixer->Process(out.data(), kBlock, run->frame);
    run->allocations += ThreadAllocations() - before;
    run->frame += kBlock;
    AppendLeft(&run->left, out, kBlock);
  }
}

void CheckFirstSound(const Run& run, uint64_t want, const char* label) {
  const int64_t got = FirstAbove(run.left, kOnsetThreshold);
  Check(got == static_cast<int64_t>(want), label);
  if (got != static_cast<int64_t>(want)) {
    std::fprintf(
        stderr,
        "  first sound at %lld, expected %llu\n",
        static_cast<long long>(got),
        static_cast<unsigned long long>(want)
    );
  }
}

void CheckStartBlockClock(const kitbag::Mixer& mixer, int64_t head) {
  const kitbag::SongClock& clock = mixer.song_clock();
  Check(
      clock.start_index == kLead && !clock.Plays(kLead - 1) &&
          clock.Plays(kLead),
      "play_at: the song clock opens on the start frame's index"
  );
  Check(
      clock.PointAt(kLead).frame == head,
      "play_at: the song clock reads the head on the start frame"
  );
}

void TestStartsOnTheFrame() {
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, kRampFrames, kRampOffset);
  mixer.Seek(kHead, kZeroClock, false);
  Run run{.mixer = &mixer};
  Check(mixer.PlayAt(kStartFrame), "play_at: queued");
  Render(&run, kStartBlock);
  Check(!mixer.is_playing(), "play_at: not playing before the start frame");
  Render(&run, 1);
  Check(mixer.is_playing(), "play_at: playing from the start block");
  CheckStartBlockClock(mixer, static_cast<int64_t>(kHead));
  Render(&run, kRunBlocks);
  CheckFirstSound(run, kStartFrame, "play_at: silent until the start frame");
  ExpectAt(
      run.left,
      static_cast<int64_t>(kStartFrame),
      kRampOffset + kHead,
      "play_at: the start frame plays the head"
  );
  ExpectAt(
      run.left,
      static_cast<int64_t>(kStartFrame + kBlock),
      kRampOffset + kHead + kBlock,
      "play_at: playback runs on from the head"
  );
  Check(run.allocations == 0, "play_at: the callback allocates nothing");
}

void TestPastFrameStartsAtOnce() {
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, kRampFrames, kRampOffset);
  Run run{.mixer = &mixer};
  Render(&run, kStartBlock);
  mixer.PlayAt(kLead);
  Render(&run, 1);
  CheckFirstSound(
      run,
      uint64_t{kStartBlock} * kBlock,
      "play_at: a frame already past starts on the next block"
  );
}

void CheckCancelled(void (*cancel)(kitbag::Mixer*), const char* label) {
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, kRampFrames, kRampOffset);
  Run run{.mixer = &mixer};
  mixer.PlayAt(kStartFrame);
  Render(&run, kStartBlock - 2);
  cancel(&mixer);
  Render(&run, kRunBlocks);
  Check(
      FirstAbove(run.left, kOnsetThreshold) == kNotFound && !mixer.is_playing(),
      label
  );
}

void PauseMixer(kitbag::Mixer* mixer) {
  mixer->Pause();
}

void StopMixer(kitbag::Mixer* mixer) {
  mixer->Stop(kZeroClock, false);
}

void TestLastTransportCallWins() {
  CheckCancelled(PauseMixer, "play_at: a pause before the frame cancels it");
  CheckCancelled(StopMixer, "play_at: a stop before the frame cancels it");
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, kRampFrames, kRampOffset);
  Run run{.mixer = &mixer};
  mixer.PlayAt(kStartFrame);
  mixer.PlayAt(kLaterStart);
  Render(&run, kRunBlocks);
  CheckFirstSound(run, kLaterStart, "play_at: a second play_at replaces it");
  mixer.PlayAt(kStartFrame + kRunBlocks * kBlock);
  mixer.Play();
  Render(&run, 1);
  ExpectAt(
      run.left,
      static_cast<int64_t>(run.frame - kBlock),
      run.left[run.frame - kBlock - 1] + 1.0f,
      "play_at: a play replaces it and plays at once"
  );
}

void TestSeekKeepsTheStart() {
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, kRampFrames, kRampOffset);
  Run run{.mixer = &mixer};
  mixer.PlayAt(kStartFrame);
  Render(&run, 2);
  mixer.Seek(kOtherHead, kZeroClock, false);
  Render(&run, kRunBlocks);
  ExpectAt(
      run.left,
      static_cast<int64_t>(kStartFrame),
      kRampOffset + kOtherHead,
      "play_at: a seek while pending moves the head, not the start"
  );
}

void TestStretchedStartOnTheFrame() {
  kitbag::Mixer mixer(kSampleRate);
  const auto burst = static_cast<int64_t>(kHead) + kBurstLead;
  LoadPcm(&mixer, 0, ToneFixture({.frames = kToneFrames, .burst_at = burst}));
  mixer.SetRate(kSpeed, kZeroClock, false);
  mixer.Seek(kHead, kZeroClock, false);
  Run run{.mixer = &mixer};
  mixer.PlayAt(kStartFrame);
  Render(&run, kStartBlock + 1);
  Check(mixer.stretch_engaged(), "play_at: the stretch is engaged");
  CheckStartBlockClock(mixer, static_cast<int64_t>(kHead));
  Render(&run, kRunBlocks);
  const double want = static_cast<double>(kStartFrame) + kBurstLead / kSpeed;
  const int64_t got = FirstAbove(run.left, kOnsetThreshold);
  Check(
      std::fabs(static_cast<double>(got) - want) <= kOnsetToleranceFrames,
      "play_at: stretched, the head sounds on the start frame"
  );
  if (std::fabs(static_cast<double>(got) - want) > kOnsetToleranceFrames) {
    std::fprintf(stderr, "  onset %lld, expected %.1f\n", (long long)got, want);
  }
  Check(
      run.allocations == 0,
      "play_at: stretched, the callback allocates nothing"
  );
}

void TestRefusedStartStopsReading() {
  kitbag::Mixer queued(kSampleRate);
  LoadRamp(&queued, 0, kRampFrames, kRampOffset);
  Check(
      queued.PlayAt(kStartFrame) && queued.track_reading(0),
      "play_at: a queued start runs the read-ahead"
  );
  kitbag::Mixer refused(kSampleRate);
  LoadRamp(&refused, 0, kRampFrames, kRampOffset);
  FillCommandQueue(&refused);
  Check(
      !refused.PlayAt(kStartFrame) && !refused.track_reading(0),
      "play_at: a refused start from rest leaves the read-ahead stopped"
  );
}

}  // namespace

void RunPlayAtTests() {
  TestStartsOnTheFrame();
  TestPastFrameStartsAtOnce();
  TestLastTransportCallWins();
  TestSeekKeepsTheStart();
  TestStretchedStartOnTheFrame();
  TestRefusedStartStopsReading();
}

}  // namespace mixer_test
