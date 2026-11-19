#include "kitbag_api.h"

#include <cstdint>
#include <filesystem>
#include <string>
#include <vector>

#include "analysis/sidecar_path.h"
#include "analysis/song_analysis.h"
#include "analyze_test_support.h"
#include "check.h"
#include "flac_fixture.h"
#include "mp3_fixture.h"
#include "wav_fixture.h"

namespace analyze_test {

namespace {

constexpr uint64_t kWavDeclaredFrames = 120007;
constexpr size_t kWavHeaderBytes = 44;
constexpr uint64_t kWavFrameBytes =
    media_test::kFixtureChannels * sizeof(int16_t);
constexpr int kMp3DeclaredFrames = 100;
constexpr int kFlacDeclaredFrames = 100;
constexpr size_t kKeptPercent = 20;
constexpr size_t kPercent = 100;

std::vector<uint8_t> KeepPercent(std::vector<uint8_t> bytes) {
  bytes.resize(bytes.size() * kKeptPercent / kPercent);
  return bytes;
}

std::vector<uint8_t> KeepWavFrames(uint64_t frames) {
  std::vector<uint8_t> bytes = media_test::BuildWav(kWavDeclaredFrames);
  bytes.resize(kWavHeaderBytes + frames * kWavFrameBytes);
  return bytes;
}

uint64_t AllowedShortfall(uint64_t declared) {
  return kitbag::kDeclaredShortfallSlackFrames +
         declared / kitbag::kDeclaredShortfallFractionDivisor;
}

kb_result AnalyzeBytes(
    const std::filesystem::path& file,
    const std::vector<uint8_t>& bytes,
    const char* waveform_dir,
    AbiAnalysis* analysis
) {
  if (!media_test::WriteBytes(file.string(), bytes)) return KB_ERROR_INTERNAL;
  const kb_result status =
      AnalyzeThroughAbi(file.string(), waveform_dir, kAbiCap, analysis);
  std::filesystem::remove(file);
  return status;
}

void CheckDamaged(
    const std::filesystem::path& file,
    const std::vector<uint8_t>& bytes,
    const char* message
) {
  AbiAnalysis analysis;
  const kb_result status = AnalyzeBytes(file, bytes, nullptr, &analysis);
  kitbag_test::Check(
      status == KB_ERROR_INVALID_ARGUMENT && analysis.duration_sec == 0.0,
      message
  );
}

void CheckIntact(
    const std::filesystem::path& file,
    const std::vector<uint8_t>& bytes,
    double expected_sec,
    const char* message
) {
  AbiAnalysis analysis;
  const kb_result status = AnalyzeBytes(file, bytes, nullptr, &analysis);
  kitbag_test::Check(
      status == KB_OK && analysis.duration_sec == expected_sec,
      message
  );
}

double Seconds(uint64_t frames, uint32_t rate) {
  return static_cast<double>(frames) / rate;
}

void TestTruncatedWavWritesNoSidecar(const std::filesystem::path& dir) {
  const std::filesystem::path wav = dir / "analyze_damaged_sidecar.wav";
  const std::string sidecar = kitbag::SidecarPath(dir.c_str(), wav.c_str());
  std::filesystem::remove(sidecar);
  AbiAnalysis analysis;
  const kb_result status = AnalyzeBytes(
      wav,
      KeepWavFrames(kWavDeclaredFrames / (kPercent / kKeptPercent)),
      dir.c_str(),
      &analysis
  );
  kitbag_test::Check(
      status == KB_ERROR_INVALID_ARGUMENT && analysis.duration_sec == 0.0 &&
          !std::filesystem::exists(sidecar),
      "damaged: a wav cut to 20% under a full-size header fails, writing no "
      "sidecar"
  );
  std::filesystem::remove(sidecar);
}

void TestWavTolerance(const std::filesystem::path& dir) {
  const std::filesystem::path wav = dir / "analyze_damaged_edge.wav";
  const uint64_t allowed = AllowedShortfall(kWavDeclaredFrames);
  CheckIntact(
      wav,
      media_test::BuildWav(kWavDeclaredFrames),
      Seconds(kWavDeclaredFrames, media_test::kFixtureRate),
      "damaged: a complete wav analyses to its full length"
  );
  CheckIntact(
      wav,
      KeepWavFrames(kWavDeclaredFrames - allowed),
      Seconds(kWavDeclaredFrames - allowed, media_test::kFixtureRate),
      "damaged: a wav short by exactly the padding tolerance still succeeds"
  );
  CheckDamaged(
      wav,
      KeepWavFrames(kWavDeclaredFrames - allowed - 1),
      "damaged: a wav one frame past the padding tolerance fails"
  );
}

void TestMp3(const std::filesystem::path& dir) {
  const std::filesystem::path mp3 = dir / "analyze_damaged.mp3";
  const std::vector<uint8_t> xing =
      BuildMp3WithXingFrameCount(kMp3DeclaredFrames, kMp3DeclaredFrames);
  CheckIntact(
      mp3,
      xing,
      Seconds(kMp3DeclaredFrames * kMp3FrameSamples, kMp3Rate),
      "damaged: a complete Xing mp3 analyses to its full length"
  );
  CheckDamaged(mp3, KeepPercent(xing), "damaged: a Xing mp3 cut to 20% fails");
  AbiAnalysis cbr;
  const kb_result status = AnalyzeBytes(
      mp3,
      KeepPercent(BuildCbrMp3WithoutInfoFrame(kMp3DeclaredFrames)),
      nullptr,
      &cbr
  );
  const double full = Seconds(kMp3DeclaredFrames * kMp3FrameSamples, kMp3Rate);
  kitbag_test::Check(
      status == KB_OK && cbr.duration_sec > 0.0 && cbr.duration_sec < full / 2,
      "damaged: a headerless CBR mp3 cut short declares nothing, so it still "
      "succeeds short"
  );
}

void TestFlac(const std::filesystem::path& dir) {
  const std::filesystem::path flac = dir / "analyze_damaged.flac";
  const std::vector<uint8_t> bytes = BuildConstantFlac(kFlacDeclaredFrames);
  CheckIntact(
      flac,
      bytes,
      Seconds(kFlacDeclaredFrames * kFlacBlockFrames, kFlacRate),
      "damaged: a complete flac analyses to its STREAMINFO length"
  );
  CheckDamaged(flac, KeepPercent(bytes), "damaged: a flac cut to 20% fails");
}

}  // namespace

void RunDamagedTests(const std::filesystem::path& dir) {
  TestTruncatedWavWritesNoSidecar(dir);
  TestWavTolerance(dir);
  TestMp3(dir);
  TestFlac(dir);
}

}  // namespace analyze_test
