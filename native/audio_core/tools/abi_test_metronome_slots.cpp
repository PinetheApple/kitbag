#include "kitbag_api.h"

#include <cmath>
#include <cstddef>
#include <cstdint>
#include <vector>

#include "abi_test_metronome.h"
#include "abi_test_render.h"
#include "abi_test_song_rig.h"
#include "check.h"
#include "time_units.h"

namespace abi_test {
namespace {

using kitbag_test::Check;

constexpr int32_t kBeep = 0;
constexpr int32_t kWoodblock = 1;
constexpr int32_t kClick = 2;
constexpr int32_t kTom = 3;
constexpr double kStandaloneBpm = 97.0;
constexpr double kPlayAlongBpm = 133.0;
constexpr double kLockScreenBpm = 151.0;
constexpr double kLeadSeconds = 1.5;
constexpr double kBorrowSeconds = 2.0;
constexpr double kTailSeconds = 3.0;
constexpr double kRingOutSeconds = 0.5;
constexpr double kQuietSeconds = 2.0;
constexpr double kSameSample = 1e-3;
constexpr double kSilent = 1e-4;
constexpr double kAudible = 0.3;
constexpr double kSpacingFrames = 2.0;
constexpr size_t kMinPlayAlongClicks = 6;
constexpr int32_t kOutOfRangeSlot = KB_METRONOME_SLOT_PLAY_ALONG + 1;
constexpr int32_t kNegativeSlot = -1;

std::vector<float> RenderSeconds(kb_engine* engine, double seconds) {
  const auto blocks = static_cast<int64_t>(
      std::ceil(seconds * kb_engine_sample_rate(engine) / kRigBlock)
  );
  std::vector<float> out;
  for (int64_t block_index = 0; block_index < blocks; ++block_index) {
    const std::vector<float> block = Render(engine, kRigBlock);
    out.insert(out.end(), block.begin(), block.end());
  }
  return out;
}

double MaxDifference(const std::vector<float>& a, const std::vector<float>& b) {
  double worst = a.size() == b.size() ? 0.0 : HUGE_VAL;
  for (size_t i = 0; i < a.size() && i < b.size(); ++i) {
    worst = std::fmax(worst, std::fabs(static_cast<double>(a[i] - b[i])));
  }
  return worst;
}

kb_engine* StandaloneRunning() {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return nullptr;
  kb_metronome_set_tempo(engine, kStandaloneBpm);
  kb_metronome_set_beats(engine, 3, 4);
  kb_metronome_set_sounds(engine, kBeep, kWoodblock);
  kb_metronome_set_accent(engine, 1, KB_ACCENT_ACCENTED);
  kb_metronome_set_subdivision(engine, 2);
  kb_metronome_set_volume(engine, 0.7);
  kb_metronome_start(engine);
  return engine;
}

void ChangeEverythingInPlayAlong(kb_engine* engine) {
  kb_metronome_select_slot(engine, KB_METRONOME_SLOT_PLAY_ALONG);
  kb_metronome_set_beats(engine, 7, 8);
  kb_metronome_set_sounds(engine, kTom, kClick);
  kb_metronome_set_accent(engine, 0, KB_ACCENT_MUTED);
  kb_metronome_set_subdivision(engine, 3);
  kb_metronome_set_volume(engine, 1.6);
  kb_metronome_set_latency_offset(engine, 120.0);
  kb_metronome_set_bar_mute(engine, 1, 1, 1);
  kb_metronome_set_count_in(engine, 2, 1, kWoodblock);
  kb_metronome_anchor_external(
      engine,
      1.234,
      kb_engine_frames_rendered(engine),
      kPlayAlongBpm
  );
}

void CheckBorrowedRun(kb_engine* borrowed, kb_engine* untouched) {
  RenderSeconds(borrowed, kLeadSeconds);
  RenderSeconds(untouched, kLeadSeconds);
  ChangeEverythingInPlayAlong(borrowed);
  RenderSeconds(borrowed, kBorrowSeconds);
  Check(
      kb_metronome_current_bpm(borrowed) == kPlayAlongBpm &&
          kb_metronome_selected_slot(borrowed) == KB_METRONOME_SLOT_PLAY_ALONG,
      "slots: reads follow the selected slot"
  );
  kb_metronome_select_slot(borrowed, KB_METRONOME_SLOT_STANDALONE);
  RenderSeconds(borrowed, kRingOutSeconds);
  RenderSeconds(untouched, kRingOutSeconds);
  const std::vector<float> after = RenderSeconds(borrowed, kTailSeconds);
  const std::vector<float> reference = RenderSeconds(untouched, kTailSeconds);
  Check(RenderPeakOf(reference) > kAudible, "slots: the reference run clicks");
  Check(
      MaxDifference(after, reference) < kSameSample,
      "slots: standalone resumes sample for sample after play along changed "
      "everything"
  );
  Check(
      kb_metronome_is_running(borrowed) == 1 &&
          kb_metronome_current_bpm(borrowed) == kStandaloneBpm,
      "slots: standalone reads its own run state and tempo again"
  );
}

void TestStandaloneSurvivesPlayAlong() {
  kb_engine* borrowed = StandaloneRunning();
  kb_engine* untouched = StandaloneRunning();
  if (borrowed != nullptr && untouched != nullptr) {
    CheckBorrowedRun(borrowed, untouched);
  }
  kb_engine_destroy(borrowed);
  kb_engine_destroy(untouched);
}

bool EvenlySpaced(const std::vector<Onset>& onsets, double frames) {
  for (size_t i = 1; i < onsets.size(); ++i) {
    const auto gap = static_cast<double>(onsets[i].frame - onsets[i - 1].frame);
    if (std::fabs(gap - frames) > kSpacingFrames) return false;
  }
  return onsets.size() >= kMinPlayAlongClicks;
}

void CheckOnlyPlayAlongClicks(kb_engine* engine) {
  kb_metronome_set_tempo(engine, kPlayAlongBpm);
  kb_metronome_start(engine);
  SongRig rig{.engine = engine, .base_ns = kitbag::MonotonicNs()};
  const double seconds = kTailSeconds * kb_engine_sample_rate(engine);
  while (static_cast<double>(rig.rendered) < seconds) rig.Render(kRigBlock);
  const double beat_frames =
      kitbag::kSecondsPerMinute / kPlayAlongBpm * kb_engine_sample_rate(engine);
  Check(
      EvenlySpaced(rig.onsets, beat_frames),
      "slots: only the selected slot's beats sound, none from the suspended one"
  );
}

void TestOnlySelectedSlotSounds() {
  kb_engine* engine = StandaloneRunning();
  if (engine == nullptr) return;
  kb_metronome_set_volume(engine, 2.0);
  RenderSeconds(engine, kLeadSeconds);
  kb_metronome_select_slot(engine, KB_METRONOME_SLOT_PLAY_ALONG);
  RenderSeconds(engine, kRingOutSeconds);
  Check(
      RenderPeakOf(RenderSeconds(engine, kQuietSeconds)) < kSilent,
      "slots: a running suspended slot is silent once its tail rings out"
  );
  CheckOnlyPlayAlongClicks(engine);
  kb_engine_destroy(engine);
}

void TestIdleFollowsSelectedIntent() {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return;
  kb_metronome_select_slot(engine, KB_METRONOME_SLOT_PLAY_ALONG);
  kb_metronome_start(engine);
  Check(kb_engine_idle(engine) == 0, "slots: the selected slot's intent holds");
  kb_metronome_select_slot(engine, KB_METRONOME_SLOT_STANDALONE);
  Check(
      kb_engine_idle(engine) == 1,
      "slots: a suspended slot's intent does not"
  );
  kb_metronome_start(engine);
  kb_metronome_select_slot(engine, KB_METRONOME_SLOT_PLAY_ALONG);
  kb_metronome_stop(engine);
  kb_metronome_select_slot(engine, KB_METRONOME_SLOT_STANDALONE);
  Check(
      kb_engine_idle(engine) == 0,
      "slots: stopping play along leaves the standalone intent standing"
  );
  kb_engine_destroy(engine);
}

void CheckSongCountInOnStandalone(kb_engine* engine, uint64_t later) {
  kb_metronome_slot_count_in_at(
      engine,
      KB_METRONOME_SLOT_STANDALONE,
      later,
      later / 2.0,
      4,
      1
  );
  kb_metronome_slot_stop(engine, KB_METRONOME_SLOT_PLAY_ALONG);
  Check(
      kb_metronome_intends_to_play(engine) == 0,
      "slots: the song count-in leaves play along without intent"
  );
  kb_metronome_select_slot(engine, KB_METRONOME_SLOT_STANDALONE);
  RenderSeconds(engine, kLeadSeconds);
  Check(
      kb_metronome_intends_to_play(engine) == 1 &&
          kb_metronome_is_running(engine) == 1,
      "slots: a slot-addressed count-in runs the standalone slot"
  );
}

void TestIntentReadsQueuedStarts() {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return;
  const uint64_t later = kb_engine_sample_rate(engine);
  kb_metronome_select_slot(engine, KB_METRONOME_SLOT_PLAY_ALONG);
  kb_metronome_start_at(engine, later);
  Check(
      kb_metronome_intends_to_play(engine) == 1 &&
          kb_metronome_is_running(engine) == 0,
      "slots: a queued start is play intent before the slot runs"
  );
  CheckSongCountInOnStandalone(engine, later);
  kb_engine_destroy(engine);
}

void CheckLockScreenCalls(kb_engine* engine) {
  const auto standalone = KB_METRONOME_SLOT_STANDALONE;
  kb_metronome_slot_set_tempo(engine, standalone, kLockScreenBpm);
  kb_metronome_slot_start_at(
      engine,
      standalone,
      kb_engine_frames_rendered(engine)
  );
  Render(engine, kRigBlock);
  Check(
      kb_metronome_slot_current_bpm(engine, standalone) == kLockScreenBpm &&
          kb_metronome_current_bpm(engine) == kPlayAlongBpm,
      "slot calls: the standalone tempo moves, play along keeps its own"
  );
  kb_metronome_slot_stop(engine, standalone);
  Render(engine, kRigBlock);
  Check(
      kb_metronome_is_running(engine) == 1,
      "slot calls: stopping standalone leaves play along running"
  );
  kb_metronome_select_slot(engine, standalone);
  Check(
      kb_metronome_is_running(engine) == 0,
      "slot calls: the standalone slot took the stop"
  );
}

void TestLockScreenAddressesStandalone() {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return;
  kb_metronome_set_tempo(engine, kStandaloneBpm);
  kb_metronome_select_slot(engine, KB_METRONOME_SLOT_PLAY_ALONG);
  kb_metronome_set_tempo(engine, kPlayAlongBpm);
  kb_metronome_start(engine);
  Render(engine, kRigBlock);
  CheckLockScreenCalls(engine);
  kb_engine_destroy(engine);
}

void TestOutOfRangeSlotsIgnored() {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return;
  kb_metronome_select_slot(engine, kOutOfRangeSlot);
  kb_metronome_select_slot(engine, kNegativeSlot);
  kb_metronome_select_slot(nullptr, KB_METRONOME_SLOT_PLAY_ALONG);
  kb_metronome_slot_set_tempo(engine, kOutOfRangeSlot, kLockScreenBpm);
  kb_metronome_slot_stop(nullptr, KB_METRONOME_SLOT_STANDALONE);
  Check(
      kb_metronome_selected_slot(engine) == KB_METRONOME_SLOT_STANDALONE &&
          kb_metronome_selected_slot(nullptr) == KB_METRONOME_SLOT_STANDALONE,
      "slots: an out-of-range or null select changes nothing"
  );
  Check(
      kb_metronome_slot_current_bpm(engine, kOutOfRangeSlot) == 0.0 &&
          kb_metronome_slot_current_bpm(nullptr, 0) == 0.0,
      "slots: an out-of-range slot reads 0 bpm"
  );
  kb_engine_destroy(engine);
}

}  // namespace

void RunMetronomeSlotAbiTests() {
  TestStandaloneSurvivesPlayAlong();
  TestOnlySelectedSlotSounds();
  TestIdleFollowsSelectedIntent();
  TestIntentReadsQueuedStarts();
  TestLockScreenAddressesStandalone();
  TestOutOfRangeSlotsIgnored();
}

}  // namespace abi_test
