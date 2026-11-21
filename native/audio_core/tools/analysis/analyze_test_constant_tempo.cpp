#include "kitbag_api.h"

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <filesystem>
#include <string>
#include <vector>

#include "analysis/beat_tracker.h"
#include "analysis/meter.h"
#include "analyze_test_support.h"
#include "check.h"
#include "time_units.h"
#include "wav_fixture.h"

namespace analyze_test {
namespace {

using kitbag::BeatResult;
using kitbag_test::Check;

constexpr double kClickBpm = 117.3;
constexpr double kLeadInSec = 0.2;
constexpr int kClickBeats = 36;
constexpr int kMeter = kitbag::kTripleBeatsPerBar;
constexpr int kFirstBarOne = 2;
constexpr double kJitterSec = 0.009;
constexpr uint32_t kJitterSeed = 474;
// The tracker's beats sit 0.023 s early on these clicks (measured). A rounded
// tempo or a bar one a beat off misses by 0.3 bpm or 0.51 s.
constexpr double kBpmToleranceBpm = 0.1;
constexpr double kAnchorToleranceSec = 0.05;

double ClickPeriodSec() {
  return kitbag::kSecondsPerMinute / kClickBpm;
}

double ExpectedAnchorSec() {
  return kLeadInSec + kFirstBarOne * ClickPeriodSec();
}

std::vector<size_t> JitteredStarts() {
  uint32_t state = kJitterSeed;
  std::vector<size_t> starts;
  for (int k = 0; k < kClickBeats; ++k) {
    const double jitter = (2.0 * LcgUniform(state) - 1.0) * kJitterSec;
    const double sec = kLeadInSec + k * ClickPeriodSec() + jitter;
    starts.push_back(static_cast<size_t>(std::lround(sec * kSampleRate)));
  }
  return starts;
}

void AddBeat(std::vector<float>& pcm, size_t start, size_t end, float hz) {
  for (size_t s = start; s + kToneGuardFrames < end; ++s) {
    const float t = static_cast<float>(s - start) / kSampleRate;
    float v = kToneAmp * std::sin(kTwoPi * hz * t);
    if (s - start < kClickWidth) v += kClickAmp;
    pcm[s * 2] += v;
    pcm[s * 2 + 1] += v;
  }
}

std::vector<float> MakeJitteredMeterTrack() {
  const std::vector<size_t> starts = JitteredStarts();
  const auto period = static_cast<size_t>(ClickPeriodSec() * kSampleRate);
  std::vector<float> pcm((starts.back() + 2 * period) * 2, 0.0f);
  for (int k = 0; k < kClickBeats; ++k) {
    const size_t end = k + 1 < kClickBeats ? starts[k + 1] : starts[k] + period;
    const int bar = (k - kFirstBarOne + kClickBeats * kMeter) / kMeter;
    AddBeat(pcm, starts[k], end, kBarPitchesHz[bar % kBarPitchesHz.size()]);
  }
  return pcm;
}

std::vector<float> MakeOneClickTrack() {
  std::vector<float> pcm(static_cast<size_t>(kBeatPeriodFrames) * 4, 0.0f);
  for (int s = 0; s < kClickWidth; ++s) pcm[s * 2] = pcm[s * 2 + 1] = kClickAmp;
  return pcm;
}

void TestSteadyFit() {
  const BeatResult r = AnalyzePcm(MakeJitteredMeterTrack());
  Check(r.tempo.has_value(), "tempo: a steady click track is fitted");
  const kitbag::ConstantTempo fit = r.tempo.value_or(kitbag::ConstantTempo{});
  std::printf(
      "analyze_verify: tempo fit %.4f bpm, anchor %.4f s, %d per bar "
      "(click %.1f bpm, bar one %.4f s)\n",
      fit.bpm,
      fit.anchor_sec,
      fit.beats_per_bar,
      kClickBpm,
      ExpectedAnchorSec()
  );
  Check(
      std::fabs(fit.bpm - kClickBpm) <= kBpmToleranceBpm,
      "tempo: fitted bpm within tolerance of the click's"
  );
  Check(
      std::fabs(fit.anchor_sec - ExpectedAnchorSec()) <= kAnchorToleranceSec,
      "tempo: anchor on the first bar one, within tolerance"
  );
  Check(fit.beats_per_bar == kMeter, "tempo: beats per bar is the click's 3");
}

void TestNoSteadyTempo() {
  const BeatResult r = AnalyzePcm(MakeOneClickTrack());
  Check(!r.tempo.has_value(), "tempo: one click has no steady tempo");
}

kb_result AnalyzeWithTempo(
    const std::string& wav,
    AbiAnalysis* out,
    kb_tempo_fit* tempo
) {
  out->beats.assign(KB_MAX_GRID_BEATS, 0.0f);
  out->downbeats.assign(KB_MAX_GRID_BEATS, 0);
  return kb_analyze_song_with_tempo(
      wav.c_str(),
      &out->bpm,
      out->beats.data(),
      KB_MAX_GRID_BEATS,
      &out->beat_count,
      out->downbeats.data(),
      &out->downbeat_count,
      &out->duration_sec,
      nullptr,
      tempo
  );
}

bool SameAsStoredGridFit(const AbiAnalysis& a, const kb_tempo_fit& tempo) {
  float bpm = 0.0f;
  double anchor = 0.0;
  int32_t per_bar = 0;
  const kb_result refit = kb_fit_constant_tempo(
      a.beats.data(),
      a.beat_count,
      a.downbeats.data(),
      a.downbeat_count,
      &bpm,
      &anchor,
      &per_bar
  );
  return refit == KB_OK && tempo.bpm == bpm && tempo.anchor_sec == anchor &&
         tempo.beats_per_bar == per_bar;
}

void TestAbiFit(const std::filesystem::path& dir) {
  const std::string wav = (dir / "analyze_tempo.wav").string();
  Check(
      media_test::WriteFloatWav(wav, MakeJitteredMeterTrack(), 2, kSampleRate),
      "tempo abi: steady fixture written"
  );
  AbiAnalysis a;
  kb_tempo_fit tempo{};
  const kb_result status = AnalyzeWithTempo(wav, &a, &tempo);
  Check(
      status == KB_OK && tempo.result == KB_OK && SameAsStoredGridFit(a, tempo),
      "tempo abi: the fit is kb_fit_constant_tempo's over the returned grid"
  );
  Check(
      AnalyzeWithTempo(wav, &a, nullptr) == KB_ERROR_INVALID_ARGUMENT,
      "tempo abi: a null tempo output is refused"
  );
  std::filesystem::remove(wav);
}

void TestAbiNoFit(const std::filesystem::path& dir) {
  const std::string wav = (dir / "analyze_one_click.wav").string();
  Check(
      media_test::WriteFloatWav(wav, MakeOneClickTrack(), 2, kSampleRate),
      "tempo abi: one-click fixture written"
  );
  AbiAnalysis a;
  kb_tempo_fit tempo{KB_OK, -1.0f, -1.0, -1};
  const kb_result status = AnalyzeWithTempo(wav, &a, &tempo);
  Check(
      status == KB_OK && tempo.result == KB_ERROR_INVALID_ARGUMENT &&
          tempo.bpm == 0.0f && tempo.anchor_sec == 0.0 &&
          tempo.beats_per_bar == 0,
      "tempo abi: no steady tempo fails the fit alone, every output 0"
  );
  std::filesystem::remove(wav);
}

}  // namespace

void RunConstantTempoTests(const std::filesystem::path& dir) {
  TestSteadyFit();
  TestNoSteadyTempo();
  TestAbiFit(dir);
  TestAbiNoFit(dir);
}

}  // namespace analyze_test
