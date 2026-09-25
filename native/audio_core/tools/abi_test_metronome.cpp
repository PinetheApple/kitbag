#include "kitbag_api.h"

#include "abi_test_metronome.h"

#include <cmath>
#include <vector>

#include "check.h"

namespace abi_test {
namespace {

using kitbag_test::Check;

constexpr uint32_t kChannels = 2;
constexpr uint32_t kPitchWindow = 2400;
constexpr int32_t kTom = 3;
constexpr int32_t kHihat = 4;
constexpr double kHihatAccentHz = 5000.0;
constexpr double kTomBeatHz = 450.0;
constexpr int32_t kWoodblock = 1;
constexpr double kWoodblockAccentHz = 2400.0;
constexpr double kBeepAccentHz = 1760.0;
constexpr double kPitchTolerance = 0.05;

std::vector<float> Render(kb_engine* engine, uint32_t frames) {
  std::vector<float> out(static_cast<size_t>(frames) * kChannels);
  kb_engine_render(engine, out.data(), frames);
  return out;
}

double RenderPeak(kb_engine* engine, uint32_t frames) {
  double peak = 0.0;
  for (const float sample : Render(engine, frames)) {
    peak = std::fmax(peak, std::fabs(static_cast<double>(sample)));
  }
  return peak;
}

bool NearPeak(double actual, double expected) {
  return std::fabs(actual - expected) <= 0.05;
}

kb_engine* FourFourEngine(int32_t poly_beats) {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return nullptr;
  kb_metronome_set_tempo(engine, 120.0);
  kb_metronome_set_beats(engine, 4, 4);
  kb_metronome_set_poly(engine, poly_beats > 0 ? 1 : 0, poly_beats);
  return engine;
}

void TestSetAccentClamps() {
  kb_engine* engine = FourFourEngine(0);
  if (engine == nullptr) return;
  const uint32_t beat_frames = kb_engine_sample_rate(engine) / 2;
  kb_metronome_set_accent(engine, 1, 256);
  kb_metronome_set_accent(engine, 2, -1);
  kb_metronome_set_accent(engine, 3, KB_ACCENT_ACCENTED + 1);
  kb_metronome_set_accent(nullptr, 3, KB_ACCENT_MUTED);
  kb_metronome_start(engine);
  RenderPeak(engine, beat_frames);
  Check(
      NearPeak(RenderPeak(engine, beat_frames), 0.9),
      "set_accent: 256 clamps to accented, not wrapped to muted"
  );
  Check(
      RenderPeak(engine, beat_frames) < 0.1,
      "set_accent: -1 clamps to muted"
  );
  Check(
      NearPeak(RenderPeak(engine, beat_frames), 0.9),
      "set_accent: ACCENTED+1 clamps to accented; null engine is a no-op"
  );
  kb_engine_destroy(engine);
}

void TestSetPolyAccentClamps() {
  kb_engine* engine = FourFourEngine(3);
  if (engine == nullptr) return;
  const uint32_t poly_beat_frames = kb_engine_sample_rate(engine) * 2 / 3;
  for (int32_t beat = 0; beat < 4; ++beat) {
    kb_metronome_set_accent(engine, beat, KB_ACCENT_MUTED);
  }
  kb_metronome_set_poly_accent(engine, 0, -1);
  kb_metronome_set_poly_accent(engine, 1, 256);
  kb_metronome_set_poly_accent(engine, 2, KB_ACCENT_ACCENTED + 1);
  kb_metronome_set_poly_accent(nullptr, 1, KB_ACCENT_MUTED);
  kb_metronome_start(engine);
  Check(
      RenderPeak(engine, poly_beat_frames) < 0.1,
      "set_poly_accent: -1 clamps to muted"
  );
  Check(
      NearPeak(RenderPeak(engine, poly_beat_frames), 0.8),
      "set_poly_accent: 256 clamps to accented; null engine is a no-op"
  );
  Check(
      kb_metronome_current_poly_beat(engine) == 1,
      "current_poly_beat: reads poly slot 1 through the ABI"
  );
  Check(
      NearPeak(RenderPeak(engine, poly_beat_frames), 0.8),
      "set_poly_accent: ACCENTED+1 clamps to accented"
  );
  kb_engine_destroy(engine);
}

bool PitchIs(const std::vector<float>& out, uint32_t sample_rate, double hz) {
  int crossings = 0;
  for (size_t frame = 1; frame < kPitchWindow; ++frame) {
    const bool before = out[(frame - 1) * kChannels] < 0.0f;
    if (before != (out[frame * kChannels] < 0.0f)) ++crossings;
  }
  const double measured = crossings / 2.0 * sample_rate / kPitchWindow;
  return std::fabs(measured - hz) <= hz * kPitchTolerance;
}

void TestSetSoundsSelectsPerRole() {
  kb_engine* engine = FourFourEngine(0);
  if (engine == nullptr) return;
  const uint32_t rate = kb_engine_sample_rate(engine);
  const uint32_t beat_frames = rate / 2;
  kb_metronome_set_sounds(engine, kTom, kHihat);
  kb_metronome_set_sounds(engine, -1, 256);
  kb_metronome_set_sounds(nullptr, 0, 0);
  kb_metronome_start(engine);
  Check(
      PitchIs(Render(engine, beat_frames), rate, kHihatAccentHz),
      "set_sounds: accented downbeat plays accent_sound after invalid ids"
  );
  Check(
      PitchIs(Render(engine, beat_frames), rate, kTomBeatHz),
      "set_sounds: normal beat plays normal_sound after invalid ids"
  );
  kb_engine_destroy(engine);
}

void CheckPauseThenStop(kb_engine* engine, uint32_t rate) {
  kb_metronome_pause(engine);
  Render(engine, rate);
  kb_metronome_start(engine);
  Check(
      PitchIs(Render(engine, rate / 2), rate, kBeepAccentHz) &&
          kb_metronome_counting_in(engine) == 0,
      "pause: the next start plays bar one with no count-in"
  );
  kb_metronome_stop(engine);
  Render(engine, rate);
  kb_metronome_start(engine);
  Render(engine, rate / 2);
  Check(
      kb_metronome_counting_in(engine) == 1 &&
          kb_metronome_counting_in(nullptr) == 0,
      "stop: the next start counts in again"
  );
}

void TestCountInPauseAndStop() {
  kb_engine* engine = FourFourEngine(0);
  if (engine == nullptr) return;
  const uint32_t rate = kb_engine_sample_rate(engine);
  kb_metronome_set_count_in(engine, 1, 1, kWoodblock);
  kb_metronome_set_count_in(nullptr, 0, 0, 0);
  kb_metronome_pause(nullptr);
  kb_metronome_start(engine);
  Check(
      PitchIs(Render(engine, rate / 2), rate, kWoodblockAccentHz) &&
          kb_metronome_counting_in(engine) == 1,
      "set_count_in: a first start counts in with the distinct sound"
  );
  CheckPauseThenStop(engine, rate);
  kb_engine_destroy(engine);
}

}  // namespace

void RunMetronomeAbiTests() {
  TestSetAccentClamps();
  TestSetPolyAccentClamps();
  TestSetSoundsSelectsPerRole();
  TestCountInPauseAndStop();
}

}  // namespace abi_test
