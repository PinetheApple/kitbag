#include "click_take.h"
#include "metronome_test_audio.h"

namespace metronome_test {
namespace {

using click_take::DetectClicks;
using click_take::SameClicks;

constexpr int kWoodblock = 1;
constexpr double kWoodblockAccentHz = 2400.0;
constexpr double kWoodblockBeatHz = 1800.0;
constexpr int kCountBars = 2;
// The song's bar; the standalone metronome stays in 4/4, so a count that read
// its beats_per_bar would accent the wrong beats.
constexpr int kSongBeats = 3;
constexpr int kCountBeats = kCountBars * kSongBeats;
// Fractional, so a count stepped forward from its first beat drifts off the
// frames placed from the end.
constexpr double kBeatFrames = 12000.4;
constexpr int64_t kEnd = 100003;
constexpr int64_t kStandaloneBeatFrames = kSampleRate / 2;
constexpr int64_t kAfterEnd = kStandaloneBeatFrames * 3 / 2;
// After the third count beat has rung out, before the fourth.
constexpr int64_t kCancelAt = 55040;
constexpr int64_t kRestartAt = 70144;
constexpr size_t kBeforeCancel = 3;
constexpr uint32_t kSongOffset = 77;
constexpr int64_t kGridHead = 152965;
constexpr int kRingOutBlocks = 40;

int64_t CountBeatFrame(int64_t end, int k) {
  return std::llround(static_cast<double>(end) - k * kBeatFrames);
}

void Configure(kitbag::Metronome* metronome, int bars) {
  metronome->SetSounds(kBeepSound, kBeepSound);
  metronome->SetCountIn(bars, true, kWoodblock);
  metronome->SetTimeSignature(4, 4);
}

std::vector<int64_t> ExpectedClicks(int64_t end, int first_k) {
  std::vector<int64_t> clicks;
  for (int k = first_k; k >= 1; --k) clicks.push_back(CountBeatFrame(end, k));
  clicks.push_back(end);
  clicks.push_back(end + kStandaloneBeatFrames);
  return clicks;
}

bool CountAccents(const std::vector<float>& left) {
  bool right = true;
  for (int ordinal = 0; ordinal < kCountBeats; ++ordinal) {
    const double hz =
        ordinal % kSongBeats == 0 ? kWoodblockAccentHz : kWoodblockBeatHz;
    const int64_t at = CountBeatFrame(kEnd, kCountBeats - ordinal);
    if (!PitchIs(left, at, hz)) {
      std::fprintf(stderr, "  count beat %d at %lld\n", ordinal, (long long)at);
      right = false;
    }
  }
  return right;
}

void TestCountPlacedFromTheEnd() {
  kitbag::Metronome metronome;
  Configure(&metronome, kCountBars);
  Check(
      metronome.CountInAt(kEnd, kBeatFrames, kSongBeats),
      "count_in_at: queued"
  );
  const auto left = RenderLeft(metronome, kEnd + kAfterEnd);
  Check(
      SameClicks(DetectClicks(left), ExpectedClicks(kEnd, kCountBeats)),
      "count_in_at: each beat on its frame from the end, then bar one on it"
  );
  Check(
      CountAccents(left),
      "count_in_at: the count's bar ones follow its own beats per bar"
  );
  Check(
      PitchIs(left, kEnd, kBeepAccentHz),
      "count_in_at: the click starts on the end frame as start_at would"
  );
}

void TestPastBeatsDropped() {
  constexpr int64_t kArmAt = 40960;
  constexpr int kStillAhead = 2;
  const int64_t end = kArmAt + std::llround((kStillAhead + 0.5) * kBeatFrames);
  kitbag::Metronome metronome;
  Configure(&metronome, kCountBars);
  const auto left =
      RenderLeft(metronome, end + kAfterEnd, OnceAtFrame(kArmAt, [&](int64_t) {
                   metronome.CountInAt(end, kBeatFrames, kSongBeats);
                 }));
  Check(
      SameClicks(DetectClicks(left), ExpectedClicks(end, kStillAhead)),
      "count_in_at: beats already past are dropped, not bunched"
  );
}

std::vector<float> RenderCancelled(kitbag::Metronome* metronome, bool pause) {
  Configure(metronome, kCountBars);
  metronome->CountInAt(kEnd, kBeatFrames, kSongBeats);
  return RenderLeft(*metronome, kEnd + kAfterEnd, [&](int64_t at) {
    if (at == kCancelAt && pause) metronome->Pause();
    if (at == kCancelAt && !pause) metronome->Stop();
    if (at == kRestartAt && pause) metronome->Start();
  });
}

void TestStopAndPauseCancel() {
  kitbag::Metronome stopped;
  const auto stopped_left = RenderCancelled(&stopped, false);
  std::vector<int64_t> want = ExpectedClicks(kEnd, kCountBeats);
  want.resize(kBeforeCancel);
  Check(
      SameClicks(DetectClicks(stopped_left), want) && !stopped.is_running(),
      "count_in_at: a stop mid-count cancels it and the start"
  );
  kitbag::Metronome paused;
  const auto paused_left = RenderCancelled(&paused, true);
  const std::vector<int64_t> clicks = DetectClicks(paused_left);
  Check(
      clicks.size() > kBeforeCancel + 1 &&
          clicks[kBeforeCancel] == kRestartAt &&
          clicks[kBeforeCancel + 1] == kRestartAt + kStandaloneBeatFrames &&
          PitchIs(paused_left, kRestartAt, kBeepAccentHz),
      "count_in_at: a start after a pause mid-count plays bar one, no count"
  );
}

void TestCountOffStartsOnTheEnd() {
  kitbag::Metronome metronome;
  Configure(&metronome, kitbag::Metronome::kCountInOff);
  metronome.CountInAt(kEnd, kBeatFrames, kSongBeats);
  const auto left = RenderLeft(metronome, kEnd + kAfterEnd);
  const std::vector<int64_t> clicks = DetectClicks(left);
  Check(
      !clicks.empty() && clicks.front() == kEnd,
      "count_in_at: with the count off the click starts on the end frame"
  );
}

std::vector<float> RenderRevoiced(bool distinct, int sound) {
  kitbag::Metronome metronome;
  Configure(&metronome, kCountBars);
  metronome.CountInAt(kEnd, kBeatFrames, kSongBeats);
  return RenderLeft(metronome, kEnd, OnceAtFrame(kCancelAt, [&](int64_t) {
                      metronome.SetCountIn(kCountBars, distinct, sound);
                    }));
}

void TestArmedVoiceHolds() {
  Check(
      CountAccents(RenderRevoiced(true, kTom)),
      "count_in_at: a count sound changed mid-count leaves the armed sound"
  );
  Check(
      CountAccents(RenderRevoiced(false, kWoodblock)),
      "count_in_at: a switch to the click's sounds mid-count leaves the count's"
  );
}

struct CountMirrors {
  bool running_during = false;
  int32_t bar_before_fourth = -1;
  int32_t bar_after_fourth = -1;
  int32_t bars_total = 0;
  bool counting_after_end = true;
};

void Record(const kitbag::Metronome& metronome, int64_t at, CountMirrors* log) {
  const kitbag::TrainerMirrors& mirrors = metronome.trainer_mirrors();
  const int64_t fourth = CountBeatFrame(kEnd, kCountBeats - kSongBeats);
  if (at < kEnd) log->running_during |= metronome.is_running();
  if (at <= fourth && mirrors.counting_in()) {
    log->bar_before_fourth = mirrors.count_in_bar();
  }
  if (at > fourth && at < kEnd) log->bar_after_fourth = mirrors.count_in_bar();
  if (at < kEnd) log->bars_total = mirrors.count_in_bars_total();
  if (at > kEnd) log->counting_after_end = mirrors.counting_in();
}

void TestCountMirrors() {
  kitbag::Metronome metronome;
  Configure(&metronome, kCountBars);
  metronome.CountInAt(kEnd, kBeatFrames, kSongBeats);
  CountMirrors log;
  RenderLeft(
      metronome,
      kEnd + kAfterEnd,
      [](int64_t) {},
      [&](int64_t at) { Record(metronome, at, &log); }
  );
  Check(
      log.bar_before_fourth == 0 && log.bar_after_fourth == 1 &&
          log.bars_total == kCountBars,
      "count_in_at: the count-in mirrors count its bars"
  );
  Check(
      !log.running_during && !log.counting_after_end && metronome.is_running(),
      "count_in_at: running reads 0 through the count and 1 from the end"
  );
}

void FollowGrid(kitbag::Metronome* metronome) {
  auto grid = std::make_unique<kitbag::BeatGrid>();
  grid->beat_times_sec = {
      static_cast<double>(kGridHead) / kSampleRate,
      static_cast<double>(kGridHead + kStandaloneBeatFrames) / kSampleRate
  };
  metronome->SetGrid(std::move(grid), 0, false);
  metronome->SetFollowMixer(true);
  metronome->Start();
}

std::vector<float> RenderSongBlock(
    kitbag::Metronome* metronome,
    const kitbag::SongClock& song,
    uint64_t block_start
) {
  std::vector<float> out(static_cast<size_t>(kBlockFrames) * kChannels);
  metronome->Render(
      out.data(),
      kBlockFrames,
      kSampleRate,
      kChannels,
      block_start,
      &song
  );
  std::vector<float> left;
  for (uint32_t f = 0; f < kBlockFrames; ++f) {
    left.push_back(out[f * kChannels]);
  }
  return left;
}

const kitbag::SongClock kStartsMidBlock{
    .playing = true,
    .opens_on_jump = true,
    .first = kGridHead,
    .frames = kBlockFrames - kSongOffset,
    .start_index = kSongOffset
};

void TestFollowStartsMidBlock() {
  kitbag::Metronome metronome;
  FollowGrid(&metronome);
  const std::vector<int64_t> clicks =
      DetectClicks(RenderSongBlock(&metronome, kStartsMidBlock, 0));
  Check(
      clicks.size() == 1 && clicks.front() == kSongOffset,
      "follow: a song starting mid-block clicks on its first frame"
  );
}

// The pause leaves the beat's frame as the last one followed, so only the
// jump flag tells the replayed frame from a repeated one.
void TestFollowReplaysAJumpBackMidBlock() {
  kitbag::Metronome metronome;
  FollowGrid(&metronome);
  const kitbag::SongClock up_to_beat{
      .playing = true,
      .first = kGridHead + 1 - kBlockFrames,
      .frames = kBlockFrames
  };
  RenderSongBlock(&metronome, up_to_beat, 0);
  const kitbag::SongClock paused;
  for (int b = 1; b <= kRingOutBlocks; ++b) {
    RenderSongBlock(&metronome, paused, uint64_t{kBlockFrames} * b);
  }
  const std::vector<int64_t> clicks = DetectClicks(RenderSongBlock(
      &metronome,
      kStartsMidBlock,
      uint64_t{kBlockFrames} * (kRingOutBlocks + 1)
  ));
  Check(
      clicks.size() == 1 && clicks.front() == kSongOffset,
      "follow: a seek back onto the last beat replays it mid-block"
  );
}

}  // namespace

void RunCountInAtTests() {
  TestCountPlacedFromTheEnd();
  TestPastBeatsDropped();
  TestStopAndPauseCancel();
  TestCountOffStartsOnTheEnd();
  TestArmedVoiceHolds();
  TestCountMirrors();
  TestFollowStartsMidBlock();
  TestFollowReplaysAJumpBackMidBlock();
}

}  // namespace metronome_test
