#include <atomic>
#include <functional>
#include <string>

#include "mixer_test_stretch_support.h"
#include "rt/frame_clock.h"
#include "rt/rt_publisher.h"

namespace mixer_test {
namespace {

constexpr float kSpeed = 0.75f;
constexpr int64_t kToneFrames = int64_t{6} * kSampleRate;
constexpr int64_t kSeekTo = kSampleRate + 7;
constexpr int kSettleBlocks = 40;
constexpr int kStemCount = 5;
constexpr int kFifthKeyTrack = 4;
// 1.1 s at 48 kHz: a prime over a slow disk outlasting the grace window.
constexpr uint64_t kSlowPrimeFrames =
    kitbag::RtPublisher<int>::kReclaimGraceFrames + kSampleRate / 10;

struct Rig {
  std::atomic<uint64_t> frames{0};
  kitbag::Mixer mixer{kSampleRate};

  kitbag::FrameClock Clock() const {
    return kitbag::FrameClock::Reading(frames);
  }
  void Prepare() {
    for (int t = 0; t < kStemCount; ++t) {
      LoadSilence(&mixer, t, kToneFrames);
    }
    mixer.SetRate(kSpeed, Clock(), true);
    for (int t = 1; t < kFifthKeyTrack; ++t) {
      mixer.SetTrackPitch(t, static_cast<float>(t), Clock(), true);
    }
    mixer.Play();
    RenderPaced(&mixer, kSettleBlocks);
  }
};

// With the old date a publish here frees what the slow prime just retired,
// while a block that took its buses before that retirement can still use them.
void CheckDatedAtThePublish(
    const std::function<void(Rig*)>& prime,
    const char* survives,
    const char* freed
) {
  Rig rig;
  rig.Prepare();
  rig.mixer.set_prime_publish_hook([&rig] {
    rig.frames.fetch_add(kSlowPrimeFrames, std::memory_order_relaxed);
  });
  prime(&rig);
  rig.mixer.set_prime_publish_hook({});
  RenderPaced(&rig.mixer, 1);
  const size_t retired = rig.mixer.retired_payloads();
  rig.mixer.Seek(kSeekTo, rig.Clock(), true);
  const size_t after_next = rig.mixer.retired_payloads();
  Check(retired > 0 && after_next > retired, survives);
  if (after_next <= retired) {
    std::fprintf(stderr, "  retired %zu, then %zu\n", retired, after_next);
  }
  RenderPaced(&rig.mixer, 1);
  rig.frames.fetch_add(kSlowPrimeFrames, std::memory_order_relaxed);
  rig.mixer.Seek(kSeekTo, rig.Clock(), true);
  Check(rig.mixer.retired_payloads() < after_next, freed);
}

void PrimeBySeek(Rig* rig) {
  rig->mixer.Seek(kSeekTo, rig->Clock(), true);
}

void PrimeByConfigFlip(Rig* rig) {
  rig->mixer.SetTrackPitch(
      kFifthKeyTrack,
      static_cast<float>(kFifthKeyTrack),
      rig->Clock(),
      true
  );
}

void PrimeByJoiningStem(Rig* rig) {
  rig->mixer.UnloadTrack(kFifthKeyTrack, rig->Clock(), true);
  RenderPaced(&rig->mixer, 1);
  const std::string path = NextTempPath();
  media_test::WriteFloatWav(
      path,
      ToneFixture({.frames = kToneFrames}),
      kMono,
      kSampleRate
  );
  TempFiles().push_back(path);
  rig->mixer.LoadTrack(kFifthKeyTrack, path.c_str(), rig->Clock(), true);
  rig->mixer.SetTrackPitch(
      kFifthKeyTrack,
      static_cast<float>(kFifthKeyTrack),
      rig->Clock(),
      true
  );
}

}  // namespace

void RunRetireTests() {
  CheckDatedAtThePublish(
      PrimeBySeek,
      "retire: a slow seek dates what it retires at the publish",
      "retire: a slow seek's retirements free once the clock passes them"
  );
  CheckDatedAtThePublish(
      PrimeByConfigFlip,
      "retire: a slow config flip dates what it retires at the publish",
      "retire: a slow config flip's retirements free once the clock passes them"
  );
  CheckDatedAtThePublish(
      PrimeByJoiningStem,
      "retire: a slow joining stem dates what it retires at the publish",
      "retire: a slow joining stem's retirements free once the clock passes "
      "them"
  );
}

}  // namespace mixer_test
