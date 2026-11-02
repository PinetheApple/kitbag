#include <array>
#include <memory>
#include <thread>

#include "media/audio_source.h"
#include "mixer_test_stretch_support.h"

namespace mixer_test {
namespace {

constexpr float kSpeed = 0.75f;
constexpr int kChosenBuses = kitbag::TimeStretch::kMaxChosenConfigInstances;
constexpr int kExtraStem = kChosenBuses;
constexpr int kStems = kChosenBuses + 1;
constexpr int64_t kSongFrames = int64_t{10} * kSampleRate;
constexpr int64_t kSeekTo = kSampleRate / 2 + 7;
constexpr int kSwitchAtBlock = 10;
constexpr auto kTake = static_cast<int64_t>(kSpeed * kBlock);
constexpr int64_t kHeld = kSeekTo + kSwitchAtBlock * kTake;
constexpr int64_t kBurstAfterHeld = 3001;
constexpr int kWindowBlocks = 20;
constexpr int kOnsetBlocks = 160;
constexpr int kDragBlocks = 8;
constexpr int kDragSteps = 4;
constexpr int kRetireBlocks = 60;
constexpr int64_t kLoopLead = kSampleRate / 2;
constexpr auto kGatePoll = std::chrono::microseconds(100);
constexpr auto kGateTimeout = std::chrono::seconds(5);

class GatedReader : public kitbag::SourceReader {
 public:
  explicit GatedReader(std::vector<float> pcm) : pcm_(std::move(pcm)) {}

  uint32_t channels() const override {
    return kMono;
  }
  uint32_t sample_rate() const override {
    return kSampleRate;
  }
  uint64_t total_frames() const override {
    return pcm_.size();
  }
  kitbag::ReadResult ReadFrames(float* dst, uint64_t frames) override {
    const uint64_t left = pcm_.size() - std::min<uint64_t>(pos_, pcm_.size());
    const uint64_t n = std::min(frames, left);
    std::copy_n(pcm_.begin() + static_cast<int64_t>(pos_), n, dst);
    pos_ += n;
    const bool full = n == frames;
    return {
        n,
        full ? kitbag::ReadStatus::kOk : kitbag::ReadStatus::kEndOfStream
    };
  }
  bool SeekToFrame(uint64_t frame) override {
    if (armed_.exchange(false)) {
      entered_.store(true);
      while (!released_.load()) std::this_thread::sleep_for(kGatePoll);
    }
    pos_ = std::min<uint64_t>(frame, pcm_.size());
    return true;
  }

  void Arm() {
    armed_.store(true);
  }
  bool WaitEntered() const {
    const auto deadline = std::chrono::steady_clock::now() + kGateTimeout;
    while (!entered_.load() && std::chrono::steady_clock::now() < deadline) {
      std::this_thread::sleep_for(kGatePoll);
    }
    return entered_.load();
  }
  void Release() {
    released_.store(true);
  }

 private:
  std::vector<float> pcm_;
  uint64_t pos_ = 0;
  std::atomic<bool> armed_{false};
  std::atomic<bool> entered_{false};
  std::atomic<bool> released_{false};
};

using Readers = std::array<std::unique_ptr<GatedReader>, kStems>;

void LoadReaders(kitbag::Mixer* mixer, Readers* readers) {
  const std::vector<float> silent(kSongFrames, 0.0f);
  (*readers)[0] = std::make_unique<GatedReader>(ToneFixture(
      {.frames = kSongFrames, .burst_at = kHeld + kBurstAfterHeld, .bed = true}
  ));
  for (int t = 1; t < kStems; ++t) {
    (*readers)[t] = std::make_unique<GatedReader>(silent);
  }
  for (int t = 0; t < kStems; ++t) {
    mixer->SetTrackSource(t, (*readers)[t].get(), 0, false);
  }
  for (int t = 1; t < kChosenBuses; ++t) {
    mixer->SetTrackPitch(t, static_cast<float>(t), 0, false);
  }
  mixer->SetRate(kSpeed, 0, false);
}

void TestSwitchHoldsUntilReprime() {
  Readers readers;
  kitbag::Mixer mixer(kSampleRate);
  LoadReaders(&mixer, &readers);
  mixer.Seek(kSeekTo, 0, false);
  mixer.Play();
  RenderPaced(&mixer, kSwitchAtBlock);
  readers[0]->Arm();
  std::thread app([&mixer] {
    mixer.SetTrackPitch(kExtraStem, static_cast<float>(kChosenBuses), 0, false);
  });
  const bool reprimed = readers[0]->WaitEntered();
  Check(reprimed, "switch: a fifth key re-primes through the stems");
  std::vector<float> window;
  if (reprimed) window = RenderLeft(&mixer, kWindowBlocks);
  const auto held = static_cast<int64_t>(mixer.position());
  readers[0]->Release();
  app.join();
  CheckNear(held, kHeld, 0, "switch: the head holds until the re-prime lands");
  Check(
      Loudest(window, 0, static_cast<int64_t>(window.size())) == 0.0f,
      "switch: no unprimed or mixed-config bus plays in the window"
  );
  CheckNear(
      SongFrameAtOnset(&mixer, kOnsetBlocks),
      kHeld + kBurstAfterHeld,
      kOnsetToleranceFrames,
      "switch: a transient already fed before the switch is still heard"
  );
}

void TestKeyDragKeepsChosenConfig() {
  kitbag::Mixer mixer(kSampleRate);
  const std::vector<float> tone =
      ToneFixture({.frames = kSongFrames, .bed = true});
  for (int t = 0; t < kChosenBuses; ++t) LoadPcm(&mixer, t, tone);
  mixer.SetTrackPitch(1, -1.0f, 0, false);
  mixer.SetTrackPitch(2, -2.0f, 0, false);
  mixer.Play();
  RenderPaced(&mixer, kSwitchAtBlock);
  const int64_t before = mixer.fed_frames();
  for (int step = 1; step <= kDragSteps; ++step) {
    mixer.SetTrackPitch(3, static_cast<float>(step), 0, false);
    RenderPaced(&mixer, kDragBlocks);
  }
  Check(
      !mixer.key_buses_vendor_default(),
      "drag: 0 to +4 st on one stem keeps the chosen config"
  );
  CheckNear(
      mixer.fed_frames() - before,
      int64_t{kDragSteps} * kDragBlocks * kBlock,
      0,
      "drag: the guard never re-primes during a drag"
  );
  RenderPaced(&mixer, kRetireBlocks);
  mixer.SetTrackPitch(3, static_cast<float>(kDragSteps), 0, false);
  Check(
      mixer.key_bus_count() == kChosenBuses,
      "drag: drained empty buses are retired by the app thread"
  );
}

void TestUnloadKeepsConfigUntilSeek() {
  kitbag::Mixer mixer(kSampleRate);
  const std::vector<float> tone = ToneFixture({.frames = kSongFrames});
  for (int t = 0; t < kStems; ++t) LoadPcm(&mixer, t, tone);
  for (int t = 1; t < kStems; ++t) {
    mixer.SetTrackPitch(t, static_cast<float>(t), 0, false);
  }
  mixer.Play();
  RenderPaced(&mixer, kSwitchAtBlock);
  Check(mixer.key_buses_vendor_default(), "guard: five keys run presetDefault");
  mixer.UnloadTrack(kExtraStem, 0, false);
  Check(
      mixer.key_buses_vendor_default(),
      "guard: an unload mid-play does not switch back"
  );
  mixer.Seek(mixer.position(), 0, false);
  Check(
      !mixer.key_buses_vendor_default(),
      "guard: the next seek switches back to the chosen config"
  );
}

void TestLoopEndBetweenHeadsKeeps() {
  const int64_t lag = LagFrames(kSpeed);
  const int64_t burst = kHeld + lag / 4;
  kitbag::Mixer mixer(kSampleRate);
  LoadPcm(&mixer, 0, ToneFixture({.frames = kSongFrames, .burst_at = burst}));
  mixer.SetRate(kSpeed, 0, false);
  mixer.Seek(kSeekTo, 0, false);
  mixer.Play();
  RenderPaced(&mixer, kSwitchAtBlock);
  mixer.SetLoop(kHeld - kLoopLead, kHeld + lag / 2, 0, false);
  const int64_t expected = OutputFramesFor(burst - kHeld, kSpeed);
  const std::vector<float> left = RenderPaced(&mixer, kOnsetBlocks);
  CheckNear(
      FirstAbove(left, kOnsetThreshold),
      expected,
      kOnsetToleranceFrames,
      "loop: an end between the heard and fed heads keeps, not jumps"
  );
}

}  // namespace

void RunSwitchTests() {
  TestSwitchHoldsUntilReprime();
  TestKeyDragKeepsChosenConfig();
  TestUnloadKeepsConfigUntilSeek();
  TestLoopEndBetweenHeadsKeeps();
}

}  // namespace mixer_test
