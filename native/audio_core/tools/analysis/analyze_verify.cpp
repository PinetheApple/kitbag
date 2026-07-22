// kb_analyze_song had zero coverage: no tool traversed Decoder -> DownmixToMono
// -> BeatTracker -> sidecar, which is how #18 shipped emitting NaN for every
// 16-bit file. This pins the composition and the guards that reject malformed
// input: channels==0, >INT_MAX frames, and non-finite samples (NaN/inf reaching
// the float->int16 cast is undefined behaviour, not merely wrong).
#include "kitbag_api.h"

#include <climits>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <filesystem>
#include <limits>
#include <string>
#include <vector>

#include "analysis/beat_tracker.h"
#include "analysis/sidecar_path.h"
#include "analysis/song_analysis.h"
#include "analysis/waveform_peaks.h"
#include "analyze_test_support.h"
#include "check.h"
#include "wav_fixture.h"

// Downbeat coverage lives in analyze_test_downbeat.cpp.
namespace analyze_test {
void RunDownbeatTests(const std::filesystem::path& dir);
}  // namespace analyze_test

namespace {

using analyze_test::AbiAnalysis;
using analyze_test::AnalyzeThroughAbi;
using analyze_test::kAbiCap;
using analyze_test::kSampleRate;
using analyze_test::MakeClickTrack;
using analyze_test::StereoInfo;
using kitbag::AnalyzeDecodedPcm;
using kitbag::BeatResult;

void TestNarrowFrames() {
  int out = -1;
  kitbag_test::Check(
      kitbag::NarrowFrames(0, &out) && out == 0,
      "NarrowFrames: zero"
  );
  kitbag_test::Check(
      kitbag::NarrowFrames(INT_MAX, &out) && out == INT_MAX,
      "NarrowFrames: INT_MAX passes exactly"
  );
  kitbag_test::Check(
      !kitbag::NarrowFrames(static_cast<uint64_t>(INT_MAX) + 1, &out),
      "NarrowFrames: INT_MAX+1 rejected, not wrapped negative"
  );
  kitbag_test::Check(
      !kitbag::NarrowFrames(std::numeric_limits<uint64_t>::max(), &out),
      "NarrowFrames: UINT64_MAX rejected"
  );
}

void TestChannelsZero() {
  const std::vector<float> pcm(8, 0.1f);
  BeatResult result;
  const kb_result status =
      AnalyzeDecodedPcm(pcm.data(), 4, StereoInfo(4, 0), "x", nullptr, &result);
  kitbag_test::Check(
      status == KB_ERROR_INVALID_ARGUMENT,
      "channels==0 rejected instead of dividing by zero into NaN"
  );
}

void TestNaNPoison() {
  std::vector<float> pcm = MakeClickTrack();
  const uint64_t frames = pcm.size() / 2;
  BeatResult ok_result;
  const kb_result ok = AnalyzeDecodedPcm(
      pcm.data(),
      frames,
      StereoInfo(frames, 2),
      "x",
      nullptr,
      &ok_result
  );
  kitbag_test::Check(ok == KB_OK, "finite control input analyses to KB_OK");

  pcm[frames] = std::numeric_limits<float>::quiet_NaN();
  BeatResult nan_result;
  const kb_result poisoned = AnalyzeDecodedPcm(
      pcm.data(),
      frames,
      StereoInfo(frames, 2),
      "x",
      nullptr,
      &nan_result
  );
  kitbag_test::Check(
      poisoned == KB_ERROR_INVALID_ARGUMENT,
      "one NaN sample rejected, not returned as KB_OK with NaN bpm"
  );
}

void TestFiniteOutput() {
  const std::vector<float> pcm = MakeClickTrack();
  const uint64_t frames = pcm.size() / 2;
  const double duration = static_cast<double>(frames) / kSampleRate;
  BeatResult result;
  const kb_result status = AnalyzeDecodedPcm(
      pcm.data(),
      frames,
      StereoInfo(frames, 2),
      "x",
      nullptr,
      &result
  );
  kitbag_test::Check(status == KB_OK, "finite click track analyses to KB_OK");
  kitbag_test::Check(
      std::isfinite(result.bpm),
      "detected bpm is finite, not NaN"
  );
  kitbag_test::Check(result.bpm > 0.0f, "detected bpm is positive");
  kitbag_test::Check(!result.beat_times.empty(), "beats were placed");
  bool in_range = true;
  for (const float t : result.beat_times) {
    if (!std::isfinite(t) || t < 0.0f || t > duration) in_range = false;
  }
  kitbag_test::Check(in_range, "every beat time is finite and within [0, dur]");
}

struct Sidecar {
  char magic[4] = {0, 0, 0, 0};
  uint32_t version = 0;
  uint32_t channels = 0;
  int64_t total_frames = 0;
  uint32_t chunk_count = 0;
  size_t data_count = 0;
};

bool ReadSidecar(const std::string& path, Sidecar* out) {
  std::FILE* f = std::fopen(path.c_str(), "rb");
  if (f == nullptr) return false;
  bool ok = std::fread(out->magic, 1, 4, f) == 4;
  ok = ok && std::fread(&out->version, sizeof(out->version), 1, f) == 1;
  ok = ok && std::fread(&out->channels, sizeof(out->channels), 1, f) == 1;
  ok = ok &&
       std::fread(&out->total_frames, sizeof(out->total_frames), 1, f) == 1;
  ok = ok && std::fread(&out->chunk_count, sizeof(out->chunk_count), 1, f) == 1;
  std::vector<int16_t> data(out->chunk_count * out->channels * 2);
  out->data_count = std::fread(data.data(), sizeof(int16_t), data.size(), f);
  std::fclose(f);
  return ok;
}

void CheckSidecarFields(
    const Sidecar& sc,
    uint64_t frames,
    int expected_chunks
) {
  kitbag_test::Check(
      std::string(sc.magic, 4) == "KWAV",
      "sidecar: magic is KWAV"
  );
  kitbag_test::Check(sc.version == 1, "sidecar: version is 1");
  kitbag_test::Check(sc.channels == 2, "sidecar: channels round-trips");
  kitbag_test::Check(
      sc.total_frames == static_cast<int64_t>(frames),
      "sidecar: total_frames round-trips"
  );
  kitbag_test::Check(
      sc.chunk_count == static_cast<uint32_t>(expected_chunks),
      "sidecar: chunk_count matches the independent computation"
  );
  kitbag_test::Check(
      sc.data_count == sc.chunk_count * sc.channels * 2,
      "sidecar: data size is chunk_count * channels * 2"
  );
}

// N is prime and above the chunk target, so chunk_size = N/target = 2 and the
// reduction lands on 2499 — no round number a wrong divisor could also produce.
// Derived from the pipeline's own constant so a scrubber retune stays pinned.
void TestSidecarRoundTrip(const std::filesystem::path& dir) {
  constexpr uint64_t kFrames = 4999;
  const auto target = static_cast<uint64_t>(kitbag::kWaveformTargetChunks);
  const int expected_chunks = static_cast<int>(kFrames / (kFrames / target));
  const std::string wav = (dir / "analyze_roundtrip.wav").string();
  kitbag_test::Check(
      media_test::WriteWav(wav, kFrames),
      "sidecar: fixture wav written"
  );

  AbiAnalysis analysis;
  const kb_result status =
      AnalyzeThroughAbi(wav, dir.string().c_str(), kAbiCap, &analysis);
  kitbag_test::Check(status == KB_OK, "sidecar: kb_analyze_song returns KB_OK");

  Sidecar sc;
  const std::string kwav =
      kitbag::SidecarPath(dir.string().c_str(), wav.c_str());
  kitbag_test::Check(ReadSidecar(kwav, &sc), "sidecar: file written and read");
  CheckSidecarFields(sc, kFrames, expected_chunks);
  std::filesystem::remove(wav);
  std::filesystem::remove(kwav);
}

// A malformed decode yields NaN/inf and finite garbage up to 3.19e38. Expected
// values below follow the documented policy — non-finite maps to 0, finite
// clamps to [-1, 1] — computed here, not read back from the code.
void TestWaveformNonFinite() {
  const float inf = std::numeric_limits<float>::infinity();
  const float nan = std::numeric_limits<float>::quiet_NaN();
  const std::vector<float> huge = {0.5f, 3.19e38f, -0.5f};
  const auto a = kitbag::ComputeWaveformPeaks(huge.data(), 3, 1, 1);
  kitbag_test::Check(
      !a.data.empty() && a.data[1] == 32767,
      "waveform: huge finite max clamps to +full-scale, not UB"
  );
  kitbag_test::Check(
      !a.data.empty() && a.data[0] == -16383,
      "waveform: in-range min quantises unclamped"
  );

  const std::vector<float> infs = {inf, -inf, 0.1f};
  const auto b = kitbag::ComputeWaveformPeaks(infs.data(), 3, 1, 1);
  kitbag_test::Check(
      b.data.size() == 2 && b.data[0] == 0 && b.data[1] == 0,
      "waveform: infinities map to 0, not UB"
  );

  const std::vector<float> nans = {nan, 0.25f, nan};
  const auto c1 = kitbag::ComputeWaveformPeaks(nans.data(), 3, 1, 1);
  const auto c2 = kitbag::ComputeWaveformPeaks(nans.data(), 3, 1, 1);
  kitbag_test::Check(
      c1.data == c2.data && !c1.data.empty() && c1.data[1] == 8191,
      "waveform: NaN skipped and result is deterministic"
  );
}

}  // namespace

constexpr int kExpectedChecks = 36;

int main() {
  const std::filesystem::path dir = std::filesystem::temp_directory_path();
  TestNarrowFrames();
  TestChannelsZero();
  TestNaNPoison();
  TestFiniteOutput();
  analyze_test::RunDownbeatTests(dir);
  TestSidecarRoundTrip(dir);
  TestWaveformNonFinite();

  if (kitbag_test::g_checks != kExpectedChecks) {
    std::fprintf(
        stderr,
        "analyze_verify: ran %d checks, expected %d\n",
        kitbag_test::g_checks,
        kExpectedChecks
    );
    return 1;
  }
  if (kitbag_test::g_failures == 0) {
    std::printf("analyze_verify: all checks passed\n");
    return 0;
  }
  std::fprintf(
      stderr,
      "analyze_verify: %d failure(s)\n",
      kitbag_test::g_failures
  );
  return 1;
}
