#include "kitbag_api.h"

#include <cstdint>
#include <filesystem>
#include <string>
#include <vector>

#include "analysis/sidecar_path.h"
#include "analysis/song_analysis.h"
#include "analyze_test_support.h"
#include "check.h"
#include "wav_fixture.h"
#include "wav_shape_fixture.h"

namespace analyze_test {

namespace {

constexpr uint64_t kDeclaredFrames = 120007;
constexpr uint64_t kKeptFifth = 5;
constexpr uint64_t kCutFrames = kDeclaredFrames - kDeclaredFrames / kKeptFifth;
constexpr uint16_t kWrongBlockAlign = 1;
constexpr uint32_t kUnsizedPlaceholder = 0x7FFFF000;
constexpr uint32_t kUnsizedRiff = 0xFFFFFFFF;

double FullSeconds() {
  return FramesToSeconds(kDeclaredFrames, media_test::kFixtureRate);
}

double SecondsAfterCut(uint64_t cut) {
  return FramesToSeconds(kDeclaredFrames - cut, media_test::kFixtureRate);
}

std::vector<uint8_t> Cut(const WavShape& shape, uint64_t frames) {
  return DropFrames(BuildShapedWav(kDeclaredFrames, shape), frames);
}

void TestCutWritesNoSidecar(const std::filesystem::path& dir) {
  const std::filesystem::path wav = dir / "analyze_damaged_sidecar.wav";
  const std::string sidecar = kitbag::SidecarPath(dir.c_str(), wav.c_str());
  std::filesystem::remove(sidecar);
  AbiAnalysis analysis;
  const kb_result status =
      AnalyzeBytes(wav, Cut(WavShape{}, kCutFrames), dir.c_str(), &analysis);
  kitbag_test::Check(
      status == KB_ERROR_INVALID_ARGUMENT && analysis.duration_sec == 0.0 &&
          !std::filesystem::exists(sidecar),
      "damaged: a wav cut to 20% under a full-size header fails, writing no "
      "sidecar"
  );
  std::filesystem::remove(sidecar);
}

void TestTolerance(const std::filesystem::path& wav) {
  const uint64_t slack = kitbag::kDeclaredShortfallSlackFrames;
  CheckIntact(
      wav,
      media_test::BuildWav(kDeclaredFrames),
      FullSeconds(),
      "damaged: a complete wav analyses to its full length"
  );
  CheckIntact(
      wav,
      Cut(WavShape{}, slack),
      SecondsAfterCut(slack),
      "damaged: a wav short by exactly the slack still succeeds"
  );
  CheckDamaged(
      wav,
      Cut(WavShape{}, slack + 1),
      "damaged: a wav one frame past the slack fails"
  );
}

void TestHeaderTrust(const std::filesystem::path& wav) {
  CheckIntact(
      wav,
      BuildShapedWav(kDeclaredFrames, {.block_align = kWrongBlockAlign}),
      FullSeconds(),
      "damaged: an intact wav with a wrong blockAlign sizes frames as dr_wav "
      "does"
  );
  CheckIntact(
      wav,
      BuildShapedWav(
          kDeclaredFrames,
          {.riff_size = kUnsizedRiff, .data_size = kUnsizedPlaceholder}
      ),
      FullSeconds(),
      "damaged: a wav with an unsized data placeholder and full audio succeeds"
  );
  const std::vector<uint8_t> cut = Cut(WavShape{}, kCutFrames);
  CheckIntact(
      wav,
      Cut({.riff_size = static_cast<uint32_t>(cut.size() - kChunkHeaderBytes)},
          kCutFrames),
      SecondsAfterCut(kCutFrames),
      "damaged: a wav whose RIFF size ends before its data chunk declares "
      "nothing"
  );
}

void TestChunkWalk(const std::filesystem::path& wav) {
  CheckDamaged(
      wav,
      Cut({.sub_format = &kPcmSubFormat}, kCutFrames),
      "damaged: an extensible PCM wav cut to 20% fails"
  );
  CheckIntact(
      wav,
      Cut({.sub_format = &kAmbisonicPcmSubFormat}, kCutFrames),
      SecondsAfterCut(kCutFrames),
      "damaged: an extensible wav whose subformat GUID is not the standard "
      "PCM one declares nothing"
  );
  CheckDamaged(
      wav,
      Cut({.chunks_before_data = ListInfoChunk()}, kCutFrames),
      "damaged: a wav with a LIST chunk before data, cut to 20%, fails"
  );
  CheckDamaged(
      wav,
      Cut({.chunks_before_data = OddSizedChunk()}, kCutFrames),
      "damaged: a wav with an odd-sized chunk before data, cut to 20%, fails"
  );
}

}  // namespace

void RunDamagedWavTests(const std::filesystem::path& dir) {
  const std::filesystem::path wav = dir / "analyze_damaged.wav";
  TestCutWritesNoSidecar(dir);
  TestTolerance(wav);
  TestHeaderTrust(wav);
  TestChunkWalk(wav);
}

}  // namespace analyze_test
