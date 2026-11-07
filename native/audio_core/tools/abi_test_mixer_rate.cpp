#include "kitbag_api.h"

#include "abi_test_mixer_rate.h"

#include <cmath>
#include <cstdint>
#include <filesystem>
#include <limits>
#include <string>
#include <vector>

#include "check.h"
#include "mixer/mixer.h"
#include "wav_fixture.h"

namespace abi_test {
namespace {

using kitbag::Mixer;
using kitbag_test::Check;

constexpr uint32_t kBlock = 256;
constexpr uint32_t kStereo = 2;
constexpr uint64_t kFixtureFrames = 48000;
// Past the far end of the command ring, so the queue is certain to fill.
constexpr int kFloodCalls = 256;
constexpr float kInRange = 0.75f;

float BelowMinRate() {
  return std::nextafter(Mixer::kMinRate, 0.0f);
}

float AboveMaxRate() {
  return std::nextafter(Mixer::kMaxRate, 2.0f);
}

void Pump(kb_engine* engine) {
  std::vector<float> out(static_cast<size_t>(kBlock) * kStereo);
  kb_engine_render(engine, out.data(), kBlock);
}

void ExpectRateRefused(
    kb_engine* engine,
    float rate,
    float held,
    const char* label
) {
  const kb_result result = kb_mixer_set_rate(engine, rate);
  Pump(engine);
  Check(
      result == KB_ERROR_INVALID_ARGUMENT && kb_mixer_rate(engine) == held,
      label
  );
}

void TestRateAccepted(kb_engine* engine) {
  Check(kb_mixer_rate(engine) == kitbag::kUnityRate, "rate: starts at 1.0x");
  Check(
      kb_mixer_set_rate(engine, kInRange) == KB_OK,
      "rate: inside the range is accepted"
  );
  Pump(engine);
  Check(kb_mixer_rate(engine) == kInRange, "rate: an accepted rate applies");
}

void TestRateRefused(kb_engine* engine) {
  ExpectRateRefused(
      engine,
      BelowMinRate(),
      kInRange,
      "rate: just under 0.5x is refused"
  );
  ExpectRateRefused(
      engine,
      AboveMaxRate(),
      kInRange,
      "rate: just over 1.0x is refused"
  );
  ExpectRateRefused(
      engine,
      std::numeric_limits<float>::quiet_NaN(),
      kInRange,
      "rate: NaN is refused"
  );
  ExpectRateRefused(
      engine,
      std::numeric_limits<float>::infinity(),
      kInRange,
      "rate: infinity is refused"
  );
}

void TestRateBounds(kb_engine* engine) {
  Check(
      kb_mixer_set_rate(engine, Mixer::kMinRate) == KB_OK,
      "rate: exactly 0.5x is accepted"
  );
  Pump(engine);
  Check(kb_mixer_rate(engine) == Mixer::kMinRate, "rate: 0.5x applies");
  Check(
      kb_mixer_set_rate(engine, Mixer::kMaxRate) == KB_OK,
      "rate: exactly 1.0x is accepted"
  );
  Pump(engine);
  Check(kb_mixer_rate(engine) == Mixer::kMaxRate, "rate: 1.0x applies");
}

void TestRateQueueFull(kb_engine* engine) {
  kb_result last = KB_OK;
  for (int i = 0; i < kFloodCalls && last == KB_OK; ++i) {
    last = kb_mixer_set_rate(engine, i % 2 == 0 ? kInRange : Mixer::kMaxRate);
  }
  Check(last == KB_ERROR_BUSY, "rate: a full queue is KB_ERROR_BUSY");
  Pump(engine);
  Check(
      kb_mixer_set_rate(engine, Mixer::kMaxRate) == KB_OK,
      "rate: the queue takes calls again after a block"
  );
  Pump(engine);
}

void ExpectPitchRefused(
    kb_engine* engine,
    int32_t track,
    int32_t semitones,
    int32_t held,
    const char* label
) {
  const kb_result result = kb_mixer_set_track_pitch(engine, track, semitones);
  Pump(engine);
  Check(
      result == KB_ERROR_INVALID_ARGUMENT &&
          kb_mixer_track_pitch(engine, 0) == held,
      label
  );
}

void TestPitchAccepted(kb_engine* engine) {
  Check(kb_mixer_track_pitch(engine, 0) == 0, "pitch: starts at 0");
  Check(
      kb_mixer_set_track_pitch(engine, 0, Mixer::kMinPitchSemitones) == KB_OK,
      "pitch: the bottom of the range is accepted"
  );
  Pump(engine);
  Check(
      kb_mixer_track_pitch(engine, 0) == Mixer::kMinPitchSemitones,
      "pitch: the bottom applies"
  );
  Check(
      kb_mixer_set_track_pitch(engine, 0, Mixer::kMaxPitchSemitones) == KB_OK,
      "pitch: the top of the range is accepted"
  );
  Pump(engine);
  Check(
      kb_mixer_track_pitch(engine, 0) == Mixer::kMaxPitchSemitones,
      "pitch: the top applies"
  );
}

constexpr int32_t kHeld = Mixer::kMaxPitchSemitones;

void TestPitchOutsideRangeRefused(kb_engine* engine) {
  ExpectPitchRefused(
      engine,
      0,
      Mixer::kMinPitchSemitones - 1,
      kHeld,
      "pitch: one under the range is refused"
  );
  ExpectPitchRefused(
      engine,
      0,
      Mixer::kMaxPitchSemitones + 1,
      kHeld,
      "pitch: one over the range is refused"
  );
}

void TestPitchOnBadTrackRefused(kb_engine* engine) {
  ExpectPitchRefused(
      engine,
      -1,
      1,
      kHeld,
      "pitch: a negative track is refused"
  );
  ExpectPitchRefused(
      engine,
      Mixer::kMaxTracks,
      1,
      kHeld,
      "pitch: a track past the last is refused"
  );
  ExpectPitchRefused(
      engine,
      1,
      1,
      kHeld,
      "pitch: a track not loaded is refused"
  );
  Check(
      kb_mixer_track_pitch(engine, 1) == 0 &&
          kb_mixer_track_pitch(engine, Mixer::kMaxTracks) == 0,
      "pitch: a track without a stem reads 0"
  );
}

void TestNullEngine() {
  Check(
      kb_mixer_set_rate(nullptr, kInRange) == KB_ERROR_INVALID_ARGUMENT,
      "rate: a null engine is refused"
  );
  Check(
      kb_mixer_set_track_pitch(nullptr, 0, 1) == KB_ERROR_INVALID_ARGUMENT,
      "pitch: a null engine is refused"
  );
  Check(kb_mixer_rate(nullptr) == 0.0f, "rate: a null engine reads 0");
  Check(kb_mixer_track_pitch(nullptr, 0) == 0, "pitch: a null engine reads 0");
}

}  // namespace

void RunMixerRateAbiTests() {
  TestNullEngine();
  kb_engine* engine = nullptr;
  Check(kb_engine_create(&engine) == KB_OK, "rate: engine opens");
  if (engine == nullptr) return;
  TestRateAccepted(engine);
  TestRateRefused(engine);
  TestRateBounds(engine);
  TestRateQueueFull(engine);
  const std::string path = media_test::UniqueTempPath("kitbag_abi_rate");
  Check(media_test::WriteWav(path, kFixtureFrames), "pitch: fixture writes");
  Check(
      kb_mixer_load_track(engine, 0, path.c_str()) == KB_OK,
      "pitch: fixture loads"
  );
  TestPitchAccepted(engine);
  TestPitchOutsideRangeRefused(engine);
  TestPitchOnBadTrackRefused(engine);
  kb_engine_destroy(engine);
  std::filesystem::remove(path);
}

}  // namespace abi_test
