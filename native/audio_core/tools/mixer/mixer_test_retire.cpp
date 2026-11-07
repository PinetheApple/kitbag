#include <atomic>
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
constexpr float kFreeKey = 5.0f;
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

struct PrimeCase {
  void (*setup)(Rig*);
  void (*prime)(Rig*);
  const char* survives;
  const char* freed;
};

struct RetiredCounts {
  size_t after_prime = 0;
  size_t after_next_publish = 0;
};

// Nothing is retired before the prime, so any free up to the end is one of what
// it retired; a run whose clock stands still can free nothing, whatever the date.
RetiredCounts
RunPrimes(const PrimeCase& kase, uint64_t prime_frames, Rig* rig) {
  rig->Prepare();
  kase.setup(rig);
  rig->mixer.ReleaseRetiredSources();
  rig->mixer.set_prime_publish_hook([rig, prime_frames] {
    rig->frames.fetch_add(prime_frames, std::memory_order_relaxed);
  });
  kase.prime(rig);
  rig->mixer.set_prime_publish_hook({});
  RenderPaced(&rig->mixer, 1);
  RetiredCounts counts{.after_prime = rig->mixer.retired_payloads()};
  rig->mixer.Seek(kSeekTo, rig->Clock(), true);
  counts.after_next_publish = rig->mixer.retired_payloads();
  return counts;
}

void CheckDatedAtThePublish(const PrimeCase& kase) {
  Rig still;
  const RetiredCounts control = RunPrimes(kase, 0, &still);
  Rig slow;
  const RetiredCounts got = RunPrimes(kase, kSlowPrimeFrames, &slow);
  const bool kept = got.after_prime > 0 &&
                    got.after_prime == control.after_prime &&
                    got.after_next_publish == control.after_next_publish;
  Check(kept, kase.survives);
  if (!kept) {
    std::fprintf(
        stderr,
        "  retired %zu then %zu, standing clock %zu then %zu\n",
        got.after_prime,
        got.after_next_publish,
        control.after_prime,
        control.after_next_publish
    );
  }
  RenderPaced(&slow.mixer, 1);
  slow.frames.fetch_add(kSlowPrimeFrames, std::memory_order_relaxed);
  slow.mixer.Seek(kSeekTo, slow.Clock(), true);
  Check(slow.mixer.retired_payloads() < got.after_next_publish, kase.freed);
}

void NoSetup(Rig*) {}

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

// Key 0 goes free, so the stem joining there is the fifth key and primes.
void FreeKeyZero(Rig* rig) {
  rig->mixer.UnloadTrack(kFifthKeyTrack, rig->Clock(), true);
  rig->mixer.SetTrackPitch(0, kFreeKey, rig->Clock(), true);
  RenderPaced(&rig->mixer, 1);
}

void PrimeByJoiningStem(Rig* rig) {
  const std::string path = NextTempPath();
  media_test::WriteFloatWav(
      path,
      ToneFixture({.frames = kToneFrames}),
      kMono,
      kSampleRate
  );
  TempFiles().push_back(path);
  rig->mixer.LoadTrack(kFifthKeyTrack, path.c_str(), rig->Clock(), true);
}

constexpr PrimeCase kCases[] = {
    {NoSetup,
     PrimeBySeek,
     "retire: a slow seek dates what it retires at the publish",
     "retire: a slow seek's retirements free once the clock passes them"},
    {NoSetup,
     PrimeByConfigFlip,
     "retire: a slow config flip dates what it retires at the publish",
     "retire: a slow config flip's retirements free once the clock passes "
     "them"},
    {FreeKeyZero,
     PrimeByJoiningStem,
     "retire: a slow joining stem dates what it retires at the publish",
     "retire: a slow joining stem's retirements free once the clock passes "
     "them"},
};

}  // namespace

void RunRetireTests() {
  for (const PrimeCase& kase : kCases) CheckDatedAtThePublish(kase);
}

}  // namespace mixer_test
