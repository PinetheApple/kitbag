#include "kitbag_api.h"

#include <cmath>
#include <vector>

#include "abi_test_metronome.h"
#include "check.h"
#include "metronome/metronome.h"
#include "metronome/metronome_internal.h"

namespace abi_test {
namespace {

using kitbag::Metronome;
using kitbag::metronome_detail::kSecondsPerMinute;
using kitbag_test::Check;

constexpr uint32_t kChannels = 2;
constexpr double kAccentClickPeak = 0.9;
constexpr double kSubdivisionPeak = 0.3;
constexpr double kPeakTolerance = 0.05;
constexpr double kSlowBpm = 30.0;
constexpr int32_t kOffBeatSlot = 1;
constexpr int32_t kOffBeatBit = int32_t{1} << kOffBeatSlot;
constexpr int32_t kPastLastSlotBit = int32_t{1} << Metronome::kMaxSubdivision;

double RenderPeak(kb_engine* engine, uint32_t frames) {
  std::vector<float> out(static_cast<size_t>(frames) * kChannels);
  kb_engine_render(engine, out.data(), frames);
  double peak = 0.0;
  for (const float sample : out) {
    peak = std::fmax(peak, std::fabs(static_cast<double>(sample)));
  }
  return peak;
}

bool Near(double actual, double expected) {
  return std::fabs(actual - expected) <= kPeakTolerance;
}

kb_engine* EngineAt(double bpm, int32_t subdivision) {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return nullptr;
  kb_metronome_set_tempo(engine, bpm);
  kb_metronome_set_beats(engine, 4, 4);
  kb_metronome_set_subdivision(engine, subdivision);
  return engine;
}

double FirstOffBeatPeak(kb_engine* engine, double bpm, int32_t subdivision) {
  const auto tick_frames = static_cast<uint32_t>(
      kb_engine_sample_rate(engine) * kSecondsPerMinute / bpm / subdivision
  );
  kb_metronome_start(engine);
  RenderPeak(engine, tick_frames);
  return RenderPeak(engine, tick_frames);
}

double OffBeatPeakAfter(int32_t first_mask, int32_t second_mask) {
  kb_engine* engine = EngineAt(kSlowBpm, 2);
  if (engine == nullptr) return -1.0;
  kb_metronome_set_subdivision_accents(engine, 2, first_mask);
  kb_metronome_set_subdivision_accents(engine, 2, second_mask);
  const double peak = FirstOffBeatPeak(engine, kSlowBpm, 2);
  kb_engine_destroy(engine);
  return peak;
}

void TestMaskBounds() {
  Check(
      Near(OffBeatPeakAfter(0, kOffBeatBit), kAccentClickPeak),
      "set_subdivision_accents: bit 1 accents the off-beat tick"
  );
  Check(
      Near(OffBeatPeakAfter(kOffBeatBit, kPastLastSlotBit), kAccentClickPeak),
      "set_subdivision_accents: a mask past the last slot is ignored, not cut"
  );
  Check(
      Near(OffBeatPeakAfter(0, -kOffBeatBit), kSubdivisionPeak),
      "set_subdivision_accents: a negative mask is ignored"
  );
}

void TestRowBounds() {
  kb_engine* engine = EngineAt(kSlowBpm, Metronome::kMaxSubdivision);
  if (engine == nullptr) return;
  kb_metronome_set_subdivision_accents(
      engine,
      Metronome::kMaxSubdivision + 1,
      kOffBeatBit
  );
  Check(
      Near(
          FirstOffBeatPeak(engine, kSlowBpm, Metronome::kMaxSubdivision),
          kSubdivisionPeak
      ),
      "set_subdivision_accents: a row past kMaxSubdivision is ignored"
  );
  kb_engine_destroy(engine);
  engine = EngineAt(kSlowBpm, 2);
  if (engine == nullptr) return;
  kb_metronome_set_subdivision_accents(
      engine,
      Metronome::kMinSubdivision - 1,
      kOffBeatBit
  );
  kb_metronome_set_subdivision_accents(nullptr, 2, kOffBeatBit);
  Check(
      Near(FirstOffBeatPeak(engine, kSlowBpm, 2), kSubdivisionPeak),
      "set_subdivision_accents: row 0 and a null engine are no-ops"
  );
  kb_engine_destroy(engine);
}

}  // namespace

void RunSubdivisionAccentAbiTests() {
  TestMaskBounds();
  TestRowBounds();
}

}  // namespace abi_test
