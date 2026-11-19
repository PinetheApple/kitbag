#include <memory>
#include <utility>

#include "custom_sound_fixture.h"
#include "media/song_clock.h"
#include "metronome/metronome_internal.h"
#include "song_bars.h"

namespace metronome_test {
namespace {

using kitbag::Metronome;
using kitbag::metronome_detail::kBeatAmplitude;

constexpr double kSecondsPerMinute = 60.0;
constexpr double kSlowBpm = 40.0;
constexpr auto kSlowBeatFrames =
    static_cast<int64_t>(kSampleRate * kSecondsPerMinute / kSlowBpm);
constexpr size_t kLongFrames = kSampleRate;
constexpr size_t kSwapFrames = 3000;
constexpr float kOldLevel = 0.43F;
constexpr float kNewLevel = -0.29F;
constexpr int64_t kSwapBlock = 10;
constexpr int64_t kStopBlock = 5;
constexpr int64_t kAfterStopFrames = 3000;
constexpr int kAllocBlocks = 400;
constexpr int kAllocSubdivision = 4;

void StartSlow(Metronome& metronome) {
  metronome.SetTempo(kSlowBpm);
  metronome.SetTimeSignature(4, 4);
  metronome.SetSounds(kCustomSound, kCustomSound);
  metronome.Start();
}

void TestSwapMidRunFadesTheOldVoice() {
  Metronome metronome;
  Load(metronome, Level(kLongFrames, kOldLevel));
  StartSlow(metronome);
  const int64_t swap_at = kSwapBlock * kBlockFrames;
  const auto left = RenderLeft(
      metronome,
      kSlowBeatFrames + static_cast<int64_t>(kSwapFrames),
      [&](int64_t at) {
        if (at != swap_at) return;
        Load(metronome, Level(kSwapFrames, kNewLevel), at, true);
      }
  );
  Check(
      MaxStep(left, 1, kSlowBeatFrames) < kClickFreeStep,
      "swap: replacing a sounding sound fades it out with no click"
  );
  Check(
      Silent(left, swap_at + kCutFadeFrames, kSlowBeatFrames),
      "swap: the old voice is gone one fade into the next block"
  );
  Check(
      std::fabs(
          left[static_cast<size_t>(kSlowBeatFrames)] -
          kNewLevel * static_cast<float>(kBeatAmplitude)
      ) < kShapeTolerance,
      "swap: the next beat plays the new sound"
  );
}

void TestStopFadesCustomVoices() {
  Metronome metronome;
  Load(metronome, Level(kLongFrames, kOldLevel));
  StartSlow(metronome);
  const int64_t stop_at = kStopBlock * kBlockFrames;
  const auto left =
      RenderLeft(metronome, stop_at + kAfterStopFrames, [&](int64_t at) {
        if (at == stop_at) metronome.Stop();
      });
  Check(
      MaxStep(left, 1, stop_at + kAfterStopFrames) < kClickFreeStep &&
          Silent(left, stop_at + kCutFadeFrames, stop_at + kAfterStopFrames),
      "stop: a sounding custom voice fades out at the stop, with no click"
  );
}

constexpr int64_t kSeekBeat = 12000;
constexpr int64_t kSongStart = 13000;
constexpr int64_t kSeekTo = 30000;
constexpr int64_t kSeekBlock = 16;
constexpr int64_t kSeekRenderBlocks = 32;

void StartFollowing(Metronome& metronome) {
  auto grid = std::make_unique<kitbag::BeatGrid>();
  for (int64_t beat : {kSeekBeat, 4 * kSeekBeat, 8 * kSeekBeat}) {
    grid->beat_times_sec.push_back(static_cast<double>(beat) / kSampleRate);
  }
  SetSongBars(grid.get(), 0, 4);
  metronome.SetGrid(std::move(grid), kitbag_test::kZeroClock, true);
  metronome.SetFollowMixer(true);
  metronome.Start();
}

kitbag::SongClock SeekClock(int64_t block, bool continues) {
  const bool jumped = block >= kSeekBlock;
  return {
      .playing = true,
      .opens_on_jump = block == kSeekBlock,
      .continues_run = continues,
      .first = jumped ? kSeekTo + (block - kSeekBlock) * kBlockFrames
                      : kSongStart + block * kBlockFrames,
      .frames = kBlockFrames
  };
}

// The preview sounds before following starts: a followed click is never custom.
std::vector<float> RenderFollowSeek(bool continues) {
  Metronome metronome;
  Load(metronome, Level(kLongFrames, kOldLevel));
  metronome.PreviewSound(kCustomSound, true);
  std::vector<float> buffer(size_t{kBlockFrames} * kChannels);
  std::vector<float> left;
  for (int64_t block = 0; block < kSeekRenderBlocks; ++block) {
    if (block == 1) StartFollowing(metronome);
    const kitbag::SongClock clock = SeekClock(block, continues);
    std::fill(buffer.begin(), buffer.end(), 0.0F);
    const auto start = static_cast<uint64_t>(block * kBlockFrames);
    metronome.Render(
        buffer.data(),
        kBlockFrames,
        kSampleRate,
        kChannels,
        start,
        &clock
    );
    for (uint32_t f = 0; f < kBlockFrames; ++f) {
      left.push_back(buffer[size_t{f} * kChannels]);
    }
  }
  return left;
}

void TestSeekFadesCustomVoices() {
  const int64_t seek_at = kSeekBlock * kBlockFrames;
  const int64_t end = kSeekRenderBlocks * kBlockFrames;
  const auto seeked = RenderFollowSeek(false);
  const auto continued = RenderFollowSeek(true);
  const int64_t onset = FirstSoundFrom(seeked, 0);
  Check(
      onset >= 0 && MaxStep(seeked, onset + 1, end) < kClickFreeStep &&
          Silent(seeked, seek_at + kCutFadeFrames, end),
      "seek: a mixer seek fades a previewed custom voice out, with no click"
  );
  Check(
      !Silent(continued, seek_at + kCutFadeFrames, end),
      "seek: a jump that continues the run keeps the voice sounding"
  );
}

void TestRenderAllocatesNothingWithCustomSounds() {
  Metronome metronome;
  Load(metronome, HitShape(kSwapFrames));
  metronome.SetSubdivision(kAllocSubdivision);
  metronome.SetPolyrhythm(true, 3);
  metronome.SetSounds(kCustomSound, kEmptySound);
  metronome.PreviewSound(kCustomSound, true);
  metronome.Start();
  std::vector<float> buffer(size_t{kBlockFrames} * kChannels);
  const size_t live = LiveHeapBytes();
  ResetHeapPeak();
  for (int block = 0; block < kAllocBlocks; ++block) {
    if (block == kAllocBlocks / 2) metronome.Stop();
    if (block == kAllocBlocks / 2 + 1) metronome.Start();
    const auto start = static_cast<uint64_t>(block) * kBlockFrames;
    metronome
        .Render(buffer.data(), kBlockFrames, kSampleRate, kChannels, start);
  }
  Check(
      HeapPeakGrowth() == 0 && LiveHeapBytes() == live,
      "rt: rendering custom sounds, fades included, allocates and frees nothing"
  );
}

}  // namespace

void RunCustomSoundCutTests() {
  TestSwapMidRunFadesTheOldVoice();
  TestStopFadesCustomVoices();
  TestSeekFadesCustomVoices();
  TestRenderAllocatesNothingWithCustomSounds();
}

}  // namespace metronome_test
