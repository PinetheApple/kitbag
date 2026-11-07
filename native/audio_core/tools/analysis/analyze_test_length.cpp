#include "kitbag_api.h"

#include <cmath>
#include <cstdint>
#include <filesystem>
#include <string>
#include <vector>

#include "analyze_test_support.h"
#include "check.h"
#include "mp3_fixture.h"
#include "wav_fixture.h"

namespace analyze_test {

namespace {

// Prime, so no whole number of bitrate cycles hides a dropped frame.
constexpr int kMp3Frames = 41;
constexpr uint64_t kWavFrames = 4999;

double ExactSeconds(uint64_t frames, uint32_t rate) {
  return static_cast<double>(frames) / rate;
}

void TestHeaderlessVbrMp3Length(const std::filesystem::path& dir) {
  const std::string mp3 = (dir / "analyze_length_vbr.mp3").string();
  const std::vector<uint8_t> bytes = BuildHeaderlessVbrMp3(kMp3Frames);
  kitbag_test::Check(
      media_test::WriteBytes(mp3, bytes),
      "length: VBR mp3 fixture written"
  );
  AbiAnalysis analysis;
  const kb_result status = AnalyzeThroughAbi(mp3, nullptr, kAbiCap, &analysis);
  kitbag_test::Check(status == KB_OK, "length: VBR mp3 analyses to KB_OK");

  const double exact = ExactSeconds(kMp3Frames * kMp3FrameSamples, kMp3Rate);
  kitbag_test::Check(
      analysis.duration_sec == exact,
      "length: VBR mp3 reports exactly its decoded frames / rate"
  );
  const double estimate = FirstFrameBitrateEstimateSec(bytes.size());
  const double one_frame = ExactSeconds(kMp3FrameSamples, kMp3Rate);
  kitbag_test::Check(
      std::fabs(estimate - analysis.duration_sec) > one_frame,
      "length: VBR mp3 length is not the first-frame bitrate estimate"
  );
  std::filesystem::remove(mp3);
}

void TestWavLength(const std::filesystem::path& dir) {
  const std::string wav = (dir / "analyze_length.wav").string();
  kitbag_test::Check(
      media_test::WriteWav(wav, kWavFrames),
      "length: wav fixture written"
  );
  AbiAnalysis analysis;
  const kb_result status = AnalyzeThroughAbi(wav, nullptr, kAbiCap, &analysis);
  kitbag_test::Check(status == KB_OK, "length: wav analyses to KB_OK");
  kitbag_test::Check(
      analysis.duration_sec ==
          ExactSeconds(kWavFrames, media_test::kFixtureRate),
      "length: wav reports exactly its frames / rate"
  );
  std::filesystem::remove(wav);
}

void TestErrorLength(const std::filesystem::path& dir) {
  const std::string junk = (dir / "analyze_length_junk.mp3").string();
  const std::vector<uint8_t> bytes(kWavFrames, 0);
  kitbag_test::Check(
      media_test::WriteBytes(junk, bytes),
      "length: undecodable fixture written"
  );
  AbiAnalysis analysis;
  const kb_result status = AnalyzeThroughAbi(junk, nullptr, kAbiCap, &analysis);
  kitbag_test::Check(
      status == KB_ERROR_INVALID_ARGUMENT && analysis.duration_sec == 0.0,
      "length: an undecodable file reads 0"
  );
  std::filesystem::remove(junk);
}

}  // namespace

void RunLengthTests(const std::filesystem::path& dir) {
  TestHeaderlessVbrMp3Length(dir);
  TestWavLength(dir);
  TestErrorLength(dir);
}

}  // namespace analyze_test
