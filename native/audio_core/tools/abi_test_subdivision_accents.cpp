#include "kitbag_api.h"

#include "abi_test_metronome.h"
#include "abi_test_render.h"
#include "check.h"
#include "metronome/metronome.h"
#include "metronome/metronome_internal.h"

namespace abi_test {
namespace {

using kitbag::Metronome;
using kitbag::metronome_detail::kAccentAmplitude;
using kitbag::metronome_detail::kAccentedSubdivisionGain;
using kitbag::metronome_detail::kSecondsPerMinute;
using kitbag::metronome_detail::kSubdivisionAmplitude;
using kitbag_test::Check;

constexpr double kSlowBpm = 30.0;
constexpr int32_t kOffBeatSlot = 1;
constexpr int32_t kOffBeatBit = int32_t{1} << kOffBeatSlot;
constexpr int32_t kPastLastSlotBit = int32_t{1} << Metronome::kMaxSubdivision;
constexpr double kAccentedOffBeatPeak =
    kAccentAmplitude * kAccentedSubdivisionGain;

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
      Near(OffBeatPeakAfter(0, kOffBeatBit), kAccentedOffBeatPeak),
      "set_subdivision_accents: bit 1 accents the off-beat tick"
  );
  Check(
      Near(
          OffBeatPeakAfter(kOffBeatBit, kPastLastSlotBit),
          kAccentedOffBeatPeak
      ),
      "set_subdivision_accents: a mask past the last slot is ignored, not cut"
  );
  Check(
      Near(OffBeatPeakAfter(0, -kOffBeatBit), kSubdivisionAmplitude),
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
          kSubdivisionAmplitude
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
      Near(FirstOffBeatPeak(engine, kSlowBpm, 2), kSubdivisionAmplitude),
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
