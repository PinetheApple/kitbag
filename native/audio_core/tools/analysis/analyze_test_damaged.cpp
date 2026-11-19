#include "kitbag_api.h"

#include <cstdint>
#include <filesystem>
#include <vector>

#include "analyze_test_support.h"
#include "check.h"
#include "flac_fixture.h"
#include "mp3_fixture.h"

namespace analyze_test {

void RunDamagedWavTests(const std::filesystem::path& dir);

namespace {

constexpr int kMp3DeclaredFrames = 100;
constexpr int kFlacDeclaredFrames = 100;
constexpr uint32_t kLameDelay = 576;
constexpr uint32_t kLamePadding = 1152;
constexpr size_t kKeptPercent = 20;
constexpr size_t kPercent = 100;

std::vector<uint8_t> KeepPercent(std::vector<uint8_t> bytes) {
  bytes.resize(bytes.size() * kKeptPercent / kPercent);
  return bytes;
}

void TestXingMp3(const std::filesystem::path& mp3) {
  const std::vector<uint8_t> xing =
      BuildMp3WithXingFrameCount(kMp3DeclaredFrames, kMp3DeclaredFrames);
  CheckIntact(
      mp3,
      xing,
      FramesToSeconds(kMp3DeclaredFrames * kMp3FrameSamples, kMp3Rate),
      "damaged: a complete Xing mp3 analyses to its full length"
  );
  CheckDamaged(mp3, KeepPercent(xing), "damaged: a Xing mp3 cut to 20% fails");
  AbiAnalysis lame;
  const kb_result status = AnalyzeBytes(
      mp3,
      BuildMp3WithLameTag(kMp3DeclaredFrames, kLameDelay, kLamePadding),
      nullptr,
      &lame
  );
  kitbag_test::Check(
      status == KB_OK && lame.duration_sec > 0.0,
      "damaged: a complete mp3 with LAME delay and padding still succeeds"
  );
}

void TestHeaderlessMp3(const std::filesystem::path& mp3) {
  AbiAnalysis cbr;
  const kb_result status = AnalyzeBytes(
      mp3,
      KeepPercent(BuildCbrMp3WithoutInfoFrame(kMp3DeclaredFrames)),
      nullptr,
      &cbr
  );
  const double full =
      FramesToSeconds(kMp3DeclaredFrames * kMp3FrameSamples, kMp3Rate);
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
      FramesToSeconds(kFlacDeclaredFrames * kFlacBlockFrames, kFlacRate),
      "damaged: a complete flac analyses to its STREAMINFO length"
  );
  CheckDamaged(flac, KeepPercent(bytes), "damaged: a flac cut to 20% fails");
}

}  // namespace

void RunDamagedTests(const std::filesystem::path& dir) {
  RunDamagedWavTests(dir);
  const std::filesystem::path mp3 = dir / "analyze_damaged.mp3";
  TestXingMp3(mp3);
  TestHeaderlessMp3(mp3);
  TestFlac(dir);
}

}  // namespace analyze_test
