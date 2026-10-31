#include "metronome_test_audio.h"
#include "metronome_test_rig_model.h"

namespace metronome_test {
namespace {

using kitbag::Accent;
using kitbag::Metronome;
using kitbag::metronome_detail::kBeatAmplitude;

constexpr RigCase kHundred = {100, 1};
constexpr RigCase kSixteenths = {100, 4};
constexpr int kRigAccentedSlot = 2;
constexpr int kMetronomeSubdivision = 2;
constexpr int kMetronomeAccentedSlot = 1;
constexpr int64_t kRigBeats = 8;
constexpr double kPeakTolerance = 0.05;
constexpr double kHalfVolume = 0.5;
constexpr double kLoudVolume = 1.5;
constexpr double kLatencyMs = 80.0;
constexpr double kLatencyChangedMs = -60.0;
constexpr int64_t kLatencyChangeFrame = 400 * int64_t{kBlockFrames};
constexpr int64_t kLatencyFrames = 5 * int64_t{kSampleRate};

constexpr int32_t SlotBit(int slot) {
  return int32_t{1} << slot;
}

double WantHz(int slot) {
  if (slot == 0) return kTomBeatHz;
  return slot == kRigAccentedSlot ? kHihatAccentHz : kTomSubdivisionHz;
}

bool TickSoundsMatch(const std::vector<float>& left, int64_t ticks) {
  for (int64_t tick = 0; tick < ticks; ++tick) {
    const RigTick at = ModelTick(kRigStart, kSixteenths, tick);
    if (PitchIs(left, at.frame, WantHz(at.slot))) continue;
    std::fprintf(
        stderr,
        "  tick %lld slot %d: want %.0f Hz, measured %.0f Hz\n",
        static_cast<long long>(tick),
        at.slot,
        WantHz(at.slot),
        PitchAt(left, at.frame)
    );
    return false;
  }
  return true;
}

void ConfigureConflictingPattern(Metronome& metronome) {
  metronome.SetSounds(kTom, kHihatSound);
  metronome.SetSubdivision(kMetronomeSubdivision);
  metronome.SetSubdivisionAccents(
      kMetronomeSubdivision,
      SlotBit(kMetronomeAccentedSlot)
  );
  metronome.SetSubdivisionAccents(
      kSixteenths.subdivision,
      SlotBit(kRigAccentedSlot)
  );
  metronome.SetAccent(1, Accent::kMuted);
  metronome.SetBarMute(true, 1, 1);
}

void TestSoundsFromTheRigRow() {
  Metronome metronome;
  ConfigureConflictingPattern(metronome);
  metronome.rig_click()
      .Start(kSixteenths.bpm(), kSixteenths.subdivision, kRigStart);
  const int64_t ticks = kRigBeats * kSixteenths.subdivision;
  const auto left = RenderLeft(
      metronome,
      ModelTick(kRigStart, kSixteenths, ticks).frame + kPitchWindow
  );
  CheckCase(
      TickSoundsMatch(left, ticks),
      RigLabel("beat, subdivision and accented slot sounds", kSixteenths),
      "normal beat click, its subdivision voice, the row's accent click"
  );
}

double RigBeatPeak(double volume) {
  Metronome metronome;
  metronome.SetVolume(volume);
  metronome.rig_click().Start(kHundred.bpm(), kHundred.subdivision, kRigStart);
  return PeakIn(RenderLeft(metronome, kRigStart + kPitchWindow), kRigStart);
}

void TestVolumeScalesTheClick() {
  Check(
      std::fabs(RigBeatPeak(kHalfVolume) - kBeatAmplitude * kHalfVolume) <=
          kPeakTolerance,
      "rig click: volume 0.5 halves the beat click"
  );
  Check(
      std::fabs(RigBeatPeak(kLoudVolume) - kBeatAmplitude * kLoudVolume) <=
          kPeakTolerance,
      "rig click: volume 1.5 boosts the beat click"
  );
}

std::vector<float> RenderUnderLatency(bool rig) {
  Metronome metronome;
  metronome.SetLatencyOffset(kLatencyMs);
  metronome.SetAccent(0, Accent::kNormal);
  metronome.SetTempo(kHundred.bpm());
  if (rig) {
    metronome.rig_click()
        .Start(kHundred.bpm(), kHundred.subdivision, kRigStart);
  } else {
    metronome.StartAt(kRigStart);
  }
  return RenderLeft(
      metronome,
      kLatencyFrames,
      OnceAtFrame(kLatencyChangeFrame, [&metronome](int64_t) {
        metronome.SetLatencyOffset(kLatencyChangedMs);
      })
  );
}

void TestLatencyLikeStartAt() {
  const auto rig = RenderUnderLatency(true);
  const auto metronome = RenderUnderLatency(false);
  CheckCase(
      SameSamples(rig, 0, metronome, 0, kLatencyFrames),
      "rig click: latency offset acts as on a start_at metronome",
      "rig output differs from the metronome's under the same offsets"
  );
}

}  // namespace

void RunRigClickSoundTests() {
  TestSoundsFromTheRigRow();
  TestVolumeScalesTheClick();
  TestLatencyLikeStartAt();
}

}  // namespace metronome_test
