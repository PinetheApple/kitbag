#include <array>
#include <memory>
#include <utility>

#include "custom_sound_fixture.h"
#include "media/song_clock.h"
#include "metronome/metronome_internal.h"
#include "song_bars.h"

namespace metronome_test {
namespace {

using kitbag::Accent;
using kitbag::Metronome;
using kitbag::metronome_detail::kAccentAmplitude;

constexpr int64_t kGridStep = 12000;
constexpr int kGridBeats = 8;
constexpr int64_t kSongFrames = (kGridBeats + 1) * kGridStep;
constexpr std::array<int32_t, 2> kTwoPlusTwo = {2, 2};
constexpr double kDenseBpm = 300.0;
// Coprime with the voice pool, so a steal swaps a beat for a subdivision and a
// hard cut shows as a drop rather than cancelling against the new hit.
constexpr int kDenseSubdivision = 3;
constexpr float kDenseLevel = 0.1F;
constexpr size_t kDenseFrames = 2 * kSampleRate;
constexpr int64_t kDenseRenderFrames = kSampleRate;

void SetSongGrid(Metronome& metronome) {
  auto grid = std::make_unique<kitbag::BeatGrid>();
  for (int beat = 1; beat <= kGridBeats; ++beat) {
    grid->beat_times_sec.push_back(
        static_cast<double>(beat * kGridStep) / kSampleRate
    );
  }
  SetSongBars(grid.get(), 0, 4);
  metronome.SetGrid(std::move(grid), kitbag_test::kZeroClock, true);
  metronome.SetGridGrouping(kTwoPlusTwo);
  metronome.SetGridRate(KB_GRID_RATE_DOUBLE);
  metronome.SetSubdivision(2);
}

std::vector<float> RenderFollowing(int sound) {
  Metronome metronome;
  Load(metronome, HitShape(kHitFrames));
  SetSongGrid(metronome);
  metronome.SetFollowMixer(true);
  metronome.SetSounds(sound, sound);
  metronome.Start();
  std::vector<float> buffer(kBlockFrames * kChannels);
  std::vector<float> left;
  for (int64_t done = 0; done < kSongFrames; done += kBlockFrames) {
    const kitbag::SongClock clock{
        .playing = true,
        .first = done,
        .frames = kBlockFrames
    };
    std::fill(buffer.begin(), buffer.end(), 0.0F);
    const auto start = static_cast<uint64_t>(done);
    metronome.Render(
        buffer.data(),
        kBlockFrames,
        kSampleRate,
        kChannels,
        start,
        &clock
    );
    for (uint32_t f = 0; f < kBlockFrames; ++f) {
      left.push_back(buffer[f * kChannels]);
    }
  }
  return left;
}

void TestFollowingKeepsBuiltIns() {
  const auto custom = RenderFollowing(kCustomSound);
  const auto tick = RenderFollowing(Metronome::kTickSound);
  Check(
      FirstSoundFrom(custom, 0) >= 0 &&
          SameSamples(custom, 0, tick, 0, kSongFrames),
      "follow: bar, group, beat, half-beat and subdivision clicks play tick "
      "for a custom sound"
  );
}

void TestStandaloneGridPlaysCustom() {
  Metronome metronome;
  Load(metronome, HitShape(kHitFrames));
  SetSongGrid(metronome);
  metronome.SetSounds(kCustomSound, kCustomSound);
  metronome.Start();
  const auto left = RenderLeft(metronome, 2 * kGridStep);
  const int64_t onset = FirstSoundFrom(left, 0);
  Check(
      onset == kGridStep && GainIs(left, onset, kAccentAmplitude),
      "grid: not following the mixer, the bar beat plays the custom sound"
  );
}

float MaxDrop(const std::vector<float>& left) {
  float drop = 0.0F;
  for (size_t i = 1; i < left.size(); ++i) {
    drop = std::max(drop, left[i - 1] - left[i]);
  }
  return drop;
}

// The sound outlasts the render, so every fall in level is a steal or a fade.
void TestDenseStealsStayClickFree() {
  Metronome metronome;
  Load(metronome, Level(kDenseFrames, kDenseLevel));
  metronome.SetTempo(kDenseBpm);
  metronome.SetTimeSignature(4, 4);
  metronome.SetAccent(0, Accent::kNormal);
  metronome.SetSubdivision(kDenseSubdivision);
  metronome.SetSounds(kCustomSound, kCustomSound);
  metronome.Start();
  const auto left = RenderLeft(metronome, kDenseRenderFrames);
  const float drop = MaxDrop(left);
  if (drop >= kClickFreeStep) {
    std::fprintf(stderr, "  dense steals: largest drop %.4f\n", drop);
  }
  Check(
      drop < kClickFreeStep,
      "steal: a dense pattern past the voice pool never cuts a voice dead"
  );
}

}  // namespace

void RunCustomSoundSongTests() {
  TestFollowingKeepsBuiltIns();
  TestStandaloneGridPlaysCustom();
  TestDenseStealsStayClickFree();
}

}  // namespace metronome_test
